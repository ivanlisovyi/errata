/**
 * TavernAI / SillyTavern character card PNG importer.
 *
 * Character cards embed JSON data as base64 inside PNG tEXt chunks.
 * Two formats exist:
 *   - "chara"  → chara_card_v2 (spec_version "2.0")
 *   - "ccv3"   → chara_card_v3 (spec_version "3.0")
 *
 * Both carry the same payload shape for the fields we care about.
 * This module is browser-safe (no Node APIs) and fully self-contained.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface TavernCardData {
  name: string
  description: string
  personality: string
  firstMessage: string
  messageExamples: string
  scenario: string
  creatorNotes: string
  systemPrompt: string
  postHistoryInstructions: string
  alternateGreetings: string[]
  tags: string[]
  creator: string
  characterVersion: string
  spec: string
  specVersion: string
}

/** Mapped to Errata's fragment shape, ready for creation. */
export interface ImportedCharacter {
  type: 'character'
  name: string
  description: string
  content: string
  tags: string[]
  meta: {
    importSource: 'tavern-card'
    tavernSpec: string
    tavernCreator: string
    scenario?: string
    firstMessage?: string
    messageExamples?: string
    systemPrompt?: string
    postHistoryInstructions?: string
    alternateGreetings?: string[]
    creatorNotes?: string
  }
}

// ── PNG parsing ────────────────────────────────────────────────────────

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, false) // big-endian
}

function bytesToLatin1(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i])
  }
  return s
}

interface PngTextChunk {
  keyword: string
  text: string
}

function extractTextChunks(buffer: ArrayBuffer): PngTextChunk[] {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)

  // Verify PNG signature
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Not a valid PNG file')
    }
  }

  const chunks: PngTextChunk[] = []
  let pos = 8 // skip signature

  while (pos + 8 <= bytes.length) {
    const length = readUint32(view, pos)
    const typeBytes = bytes.slice(pos + 4, pos + 8)
    const type = bytesToLatin1(typeBytes)

    if (type === 'tEXt') {
      const data = bytes.slice(pos + 8, pos + 8 + length)
      const nullIdx = data.indexOf(0)
      if (nullIdx !== -1) {
        const keyword = bytesToLatin1(data.slice(0, nullIdx))
        const text = bytesToLatin1(data.slice(nullIdx + 1))
        chunks.push({ keyword, text })
      }
    }

    if (type === 'IEND') break

    pos += 12 + length // 4 length + 4 type + data + 4 crc
  }

  return chunks
}

// ── Card decoding ──────────────────────────────────────────────────────

function decodeCardJson(base64Text: string): Record<string, unknown> {
  const binary = atob(base64Text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const json = new TextDecoder().decode(bytes)
  return JSON.parse(json)
}

function parseCardData(raw: Record<string, unknown>): TavernCardData {
  const data = (raw.data ?? raw) as Record<string, unknown>
  return {
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    personality: String(data.personality ?? ''),
    firstMessage: String(data.first_mes ?? ''),
    messageExamples: String(data.mes_example ?? ''),
    scenario: String(data.scenario ?? ''),
    creatorNotes: String(data.creator_notes ?? ''),
    systemPrompt: String(data.system_prompt ?? ''),
    postHistoryInstructions: String(data.post_history_instructions ?? ''),
    alternateGreetings: Array.isArray(data.alternate_greetings)
      ? data.alternate_greetings.map(String)
      : [],
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    creator: String(data.creator ?? ''),
    characterVersion: String(data.character_version ?? ''),
    spec: String(raw.spec ?? ''),
    specVersion: String(raw.spec_version ?? ''),
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/** Extract all TavernAI character cards found in a PNG file. */
export function extractTavernCards(buffer: ArrayBuffer): TavernCardData[] {
  const textChunks = extractTextChunks(buffer)
  const cards: TavernCardData[] = []

  // Prefer ccv3 over chara (v3 is the newer spec)
  const cardChunks = textChunks.filter(
    (c) => c.keyword === 'ccv3' || c.keyword === 'chara',
  )

  for (const chunk of cardChunks) {
    try {
      const raw = decodeCardJson(chunk.text)
      cards.push(parseCardData(raw))
    } catch {
      // Skip malformed chunks
    }
  }

  return cards
}

/** Check whether an ArrayBuffer looks like a PNG with tavern card data. */
export function isTavernCardPng(buffer: ArrayBuffer): boolean {
  try {
    return extractTavernCards(buffer).length > 0
  } catch {
    return false
  }
}

/**
 * Parse a TavernAI character card PNG and return data ready for
 * Errata fragment creation.
 *
 * Prefers the ccv3 (v3) card if both are present.
 */
export function importTavernCard(buffer: ArrayBuffer): ImportedCharacter {
  const cards = extractTavernCards(buffer)
  if (cards.length === 0) {
    throw new Error('No TavernAI character card data found in PNG')
  }

  // Prefer v3 over v2
  const card = cards.find((c) => c.spec === 'chara_card_v3') ?? cards[0]

  // Build content from name, description, and personality only
  const sections: string[] = []

  if (card.description) {
    sections.push(card.description)
  }

  if (card.personality) {
    sections.push(`## Personality\n${card.personality}`)
  }

  // Truncate description to 250 chars for the fragment description field
  const shortDesc = card.description.length > 250
    ? card.description.slice(0, 247) + '...'
    : card.description

  // Everything else goes into meta for reference
  const meta: ImportedCharacter['meta'] = {
    importSource: 'tavern-card',
    tavernSpec: card.spec,
    tavernCreator: card.creator,
  }
  if (card.scenario) meta.scenario = card.scenario
  if (card.firstMessage) meta.firstMessage = card.firstMessage
  if (card.messageExamples) meta.messageExamples = card.messageExamples
  if (card.systemPrompt) meta.systemPrompt = card.systemPrompt
  if (card.postHistoryInstructions) meta.postHistoryInstructions = card.postHistoryInstructions
  if (card.alternateGreetings.length > 0) meta.alternateGreetings = card.alternateGreetings
  if (card.creatorNotes) meta.creatorNotes = card.creatorNotes

  return {
    type: 'character',
    name: card.name,
    description: shortDesc,
    content: sections.join('\n\n'),
    tags: card.tags,
    meta,
  }
}

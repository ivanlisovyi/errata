import { describe, it, expect } from 'vitest'
import {
  extractTavernCards,
  isTavernCardPng,
  importTavernCard,
} from '../../src/lib/importers/tavern-card'

// ── Helpers to build minimal PNG fixtures ──────────────────────────────

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const buf = new Uint8Array(12 + data.length)
  const view = new DataView(buf.buffer)
  view.setUint32(0, data.length, false)
  buf.set(typeBytes, 4)
  buf.set(data, 8)
  // CRC covers type + data
  const crcInput = new Uint8Array(4 + data.length)
  crcInput.set(typeBytes, 0)
  crcInput.set(data, 4)
  view.setUint32(8 + data.length, crc32(crcInput), false)
  return buf
}

function makeIHDR(): Uint8Array {
  const data = new Uint8Array(13) // minimal 1x1 IHDR
  const view = new DataView(data.buffer)
  view.setUint32(0, 1, false) // width
  view.setUint32(4, 1, false) // height
  data[8] = 8  // bit depth
  data[9] = 2  // color type (RGB)
  return makeChunk('IHDR', data)
}

function makeIDAT(): Uint8Array {
  // Minimal valid IDAT (won't decompress to a real image, but structurally correct)
  return makeChunk('IDAT', new Uint8Array([0]))
}

function makeIEND(): Uint8Array {
  return makeChunk('IEND', new Uint8Array(0))
}

function makeTextChunk(keyword: string, text: string): Uint8Array {
  const kwBytes = new TextEncoder().encode(keyword)
  const textBytes = new TextEncoder().encode(text)
  const data = new Uint8Array(kwBytes.length + 1 + textBytes.length)
  data.set(kwBytes, 0)
  data[kwBytes.length] = 0 // null separator
  data.set(textBytes, kwBytes.length + 1)
  return makeChunk('tEXt', data)
}

function buildPng(...chunks: Uint8Array[]): ArrayBuffer {
  const total = PNG_SIG.length + chunks.reduce((s, c) => s + c.length, 0)
  const buf = new Uint8Array(total)
  let offset = 0
  buf.set(PNG_SIG, offset); offset += PNG_SIG.length
  for (const chunk of chunks) {
    buf.set(chunk, offset); offset += chunk.length
  }
  return buf.buffer
}

function encodeCardAsBase64(card: object): string {
  const json = JSON.stringify(card)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// ── Test card data ─────────────────────────────────────────────────────

const SAMPLE_CARD_V2 = {
  data: {
    name: 'TestChar',
    description: 'A test character for unit testing.',
    personality: 'Brave and curious.',
    first_mes: 'Hello, traveler!',
    mes_example: '',
    scenario: 'You meet them in a tavern.',
    creator_notes: 'Created for testing.',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: ['Hi there!', 'Greetings.'],
    tags: ['test', 'fantasy'],
    creator: 'test-author',
    character_version: '1.0',
  },
  spec: 'chara_card_v2',
  spec_version: '2.0',
}

const SAMPLE_CARD_V3 = {
  ...SAMPLE_CARD_V2,
  data: {
    ...SAMPLE_CARD_V2.data,
    description: 'A v3 test character.',
  },
  spec: 'chara_card_v3',
  spec_version: '3.0',
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('tavern-card importer', () => {
  describe('extractTavernCards', () => {
    it('extracts a chara v2 card', () => {
      const png = buildPng(
        makeIHDR(),
        makeIDAT(),
        makeTextChunk('chara', encodeCardAsBase64(SAMPLE_CARD_V2)),
        makeIEND(),
      )
      const cards = extractTavernCards(png)
      expect(cards).toHaveLength(1)
      expect(cards[0].name).toBe('TestChar')
      expect(cards[0].spec).toBe('chara_card_v2')
    })

    it('extracts both v2 and v3 cards', () => {
      const png = buildPng(
        makeIHDR(),
        makeIDAT(),
        makeTextChunk('chara', encodeCardAsBase64(SAMPLE_CARD_V2)),
        makeTextChunk('ccv3', encodeCardAsBase64(SAMPLE_CARD_V3)),
        makeIEND(),
      )
      const cards = extractTavernCards(png)
      expect(cards).toHaveLength(2)
      expect(cards.map((c) => c.spec)).toContain('chara_card_v2')
      expect(cards.map((c) => c.spec)).toContain('chara_card_v3')
    })

    it('returns empty for a PNG without card data', () => {
      const png = buildPng(makeIHDR(), makeIDAT(), makeIEND())
      expect(extractTavernCards(png)).toHaveLength(0)
    })

    it('throws on non-PNG data', () => {
      const garbage = new ArrayBuffer(16)
      expect(() => extractTavernCards(garbage)).toThrow('Not a valid PNG')
    })

    it('skips malformed base64 chunks', () => {
      const png = buildPng(
        makeIHDR(),
        makeIDAT(),
        makeTextChunk('chara', '!!!not-base64!!!'),
        makeTextChunk('ccv3', encodeCardAsBase64(SAMPLE_CARD_V3)),
        makeIEND(),
      )
      const cards = extractTavernCards(png)
      expect(cards).toHaveLength(1)
      expect(cards[0].spec).toBe('chara_card_v3')
    })
  })

  describe('isTavernCardPng', () => {
    it('returns true for a card PNG', () => {
      const png = buildPng(
        makeIHDR(),
        makeIDAT(),
        makeTextChunk('chara', encodeCardAsBase64(SAMPLE_CARD_V2)),
        makeIEND(),
      )
      expect(isTavernCardPng(png)).toBe(true)
    })

    it('returns false for a plain PNG', () => {
      const png = buildPng(makeIHDR(), makeIDAT(), makeIEND())
      expect(isTavernCardPng(png)).toBe(false)
    })

    it('returns false for non-PNG data', () => {
      expect(isTavernCardPng(new ArrayBuffer(8))).toBe(false)
    })
  })

  describe('importTavernCard', () => {
    it('maps card to fragment shape with name, description, personality in content', () => {
      const png = buildPng(
        makeIHDR(),
        makeIDAT(),
        makeTextChunk('chara', encodeCardAsBase64(SAMPLE_CARD_V2)),
        makeIEND(),
      )
      const result = importTavernCard(png)

      expect(result.type).toBe('character')
      expect(result.name).toBe('TestChar')
      expect(result.description).toBe('A test character for unit testing.')
      expect(result.content).toContain('A test character for unit testing.')
      expect(result.content).toContain('## Personality')
      expect(result.content).toContain('Brave and curious.')
      expect(result.tags).toEqual(['test', 'fantasy'])
    })

    it('does not include scenario or first message in content', () => {
      const png = buildPng(
        makeIHDR(),
        makeIDAT(),
        makeTextChunk('chara', encodeCardAsBase64(SAMPLE_CARD_V2)),
        makeIEND(),
      )
      const result = importTavernCard(png)

      expect(result.content).not.toContain('tavern')
      expect(result.content).not.toContain('Scenario')
      expect(result.content).not.toContain('First Message')
      expect(result.content).not.toContain('Hello, traveler')
    })

    it('stores scenario, first message, and other fields in meta', () => {
      const png = buildPng(
        makeIHDR(),
        makeIDAT(),
        makeTextChunk('chara', encodeCardAsBase64(SAMPLE_CARD_V2)),
        makeIEND(),
      )
      const result = importTavernCard(png)

      expect(result.meta.importSource).toBe('tavern-card')
      expect(result.meta.tavernCreator).toBe('test-author')
      expect(result.meta.scenario).toBe('You meet them in a tavern.')
      expect(result.meta.firstMessage).toBe('Hello, traveler!')
      expect(result.meta.alternateGreetings).toEqual(['Hi there!', 'Greetings.'])
      expect(result.meta.creatorNotes).toBe('Created for testing.')
    })

    it('prefers v3 when both versions are present', () => {
      const png = buildPng(
        makeIHDR(),
        makeIDAT(),
        makeTextChunk('chara', encodeCardAsBase64(SAMPLE_CARD_V2)),
        makeTextChunk('ccv3', encodeCardAsBase64(SAMPLE_CARD_V3)),
        makeIEND(),
      )
      const result = importTavernCard(png)

      expect(result.description).toBe('A v3 test character.')
      expect(result.meta.tavernSpec).toBe('chara_card_v3')
    })

    it('truncates long descriptions to 250 chars', () => {
      const longDesc = 'A'.repeat(300)
      const card = {
        ...SAMPLE_CARD_V2,
        data: { ...SAMPLE_CARD_V2.data, description: longDesc },
      }
      const png = buildPng(
        makeIHDR(),
        makeIDAT(),
        makeTextChunk('chara', encodeCardAsBase64(card)),
        makeIEND(),
      )
      const result = importTavernCard(png)

      expect(result.description.length).toBe(250)
      expect(result.description.endsWith('...')).toBe(true)
    })

    it('throws when no card data is found', () => {
      const png = buildPng(makeIHDR(), makeIDAT(), makeIEND())
      expect(() => importTavernCard(png)).toThrow('No TavernAI character card data found')
    })

    it('omits empty optional meta fields', () => {
      const card = {
        data: {
          name: 'Minimal',
          description: 'Just a name.',
          personality: '',
          first_mes: '',
          mes_example: '',
          scenario: '',
          creator_notes: '',
          system_prompt: '',
          post_history_instructions: '',
          alternate_greetings: [],
          tags: [],
          creator: 'nobody',
          character_version: '',
        },
        spec: 'chara_card_v2',
        spec_version: '2.0',
      }
      const png = buildPng(
        makeIHDR(),
        makeIDAT(),
        makeTextChunk('chara', encodeCardAsBase64(card)),
        makeIEND(),
      )
      const result = importTavernCard(png)

      expect(result.meta.scenario).toBeUndefined()
      expect(result.meta.firstMessage).toBeUndefined()
      expect(result.meta.alternateGreetings).toBeUndefined()
      expect(result.meta.creatorNotes).toBeUndefined()
    })
  })
})

import type { ContextBlock } from '../llm/context-builder'
import type { AgentBlockContext } from '../agents/agent-block-context'
import { getStory } from '../fragments/storage'
import { buildContextState } from '../llm/context-builder'

export function createCharacterChatBlocks(ctx: AgentBlockContext): ContextBlock[] {
  const blocks: ContextBlock[] = []

  if (ctx.character) {
    blocks.push({
      id: 'character',
      role: 'system',
      content: [
        `You are roleplaying as ${ctx.character.name}. Stay in character at all times.`,
        '',
        '## Character Details',
        ctx.character.content,
        '',
        '## Character Description',
        ctx.character.description,
      ].join('\n'),
      order: 100,
      source: 'builtin',
    })
  }

  if (ctx.personaDescription) {
    blocks.push({
      id: 'persona',
      role: 'system',
      content: [
        '## Who You Are Speaking With',
        ctx.personaDescription,
      ].join('\n'),
      order: 200,
      source: 'builtin',
    })
  }

  // Story context + instructions
  const storyContextParts: string[] = []
  storyContextParts.push(`## Story: ${ctx.story.name}`)
  storyContextParts.push(ctx.story.description)
  if (ctx.story.summary) {
    storyContextParts.push(`\n## Story Summary\n${ctx.story.summary}`)
  }

  // Prose summaries
  if (ctx.proseFragments.length > 0) {
    storyContextParts.push('\n## Story Events (use getFragment to read full prose)')
    for (const p of ctx.proseFragments) {
      if ((p.meta._librarian as { summary?: string })?.summary) {
        storyContextParts.push(`- ${p.id}: ${(p.meta._librarian as { summary?: string }).summary}`)
      } else if (p.content.length < 600) {
        storyContextParts.push(`- ${p.id}: \n${p.content}`)
      } else {
        storyContextParts.push(`- ${p.id}: ${p.content.slice(0, 500).replace(/\n/g, ' ')}... [truncated]`)
      }
    }
  }

  // Sticky fragments
  const stickyAll = [
    ...ctx.stickyGuidelines,
    ...ctx.stickyKnowledge,
    ...ctx.stickyCharacters,
  ]
  if (stickyAll.length > 0) {
    storyContextParts.push('\n## World Context')
    for (const f of stickyAll) {
      storyContextParts.push(`- ${f.id}: ${f.name} — ${f.description}`)
    }
  }

  const characterName = ctx.character?.name ?? 'the character'

  blocks.push({
    id: 'story-context',
    role: 'system',
    content: [
      '## Story Context',
      storyContextParts.join('\n'),
      '',
      '## Instructions',
      `1. Respond as ${characterName} would, using their voice, mannerisms, and knowledge.`,
      '2. You only know events up to the selected story point. Do not reference future events.',
      '3. You may use tools to look up fragment details when needed, but do NOT mention your use of tools in conversation.',
      '4. If asked about events beyond your knowledge cutoff, respond with genuine uncertainty — the character does not know.',
      '5. Stay in character. Do not break the fourth wall unless the character would.',
      '6. Keep responses natural and conversational.',
    ].join('\n'),
    order: 300,
    source: 'builtin',
  })

  return blocks
}

export async function buildCharacterChatPreviewContext(dataDir: string, storyId: string): Promise<AgentBlockContext> {
  const story = await getStory(dataDir, storyId)
  if (!story) throw new Error(`Story ${storyId} not found`)

  const ctxState = await buildContextState(dataDir, storyId, '')

  return {
    story: ctxState.story,
    proseFragments: ctxState.proseFragments,
    stickyGuidelines: ctxState.stickyGuidelines,
    stickyKnowledge: ctxState.stickyKnowledge,
    stickyCharacters: ctxState.stickyCharacters,
    guidelineShortlist: ctxState.guidelineShortlist,
    knowledgeShortlist: ctxState.knowledgeShortlist,
    characterShortlist: ctxState.characterShortlist,
    systemPromptFragments: [],
    character: undefined,
    personaDescription: 'You are speaking with a stranger you have just met. You do not know who they are.',
  }
}

import { tool } from 'ai'
import { z } from 'zod/v4'

// --- Collector ---

export interface AnalysisCollector {
  summaryUpdate: string
  mentions: Array<{ characterId: string; text: string }>
  contradictions: Array<{ description: string; fragmentIds: string[] }>
  knowledgeSuggestions: Array<{
    type: 'character' | 'knowledge'
    targetFragmentId?: string
    name: string
    description: string
    content: string
  }>
  timelineEvents: Array<{ event: string; position: 'before' | 'during' | 'after' }>
}

export function createEmptyCollector(): AnalysisCollector {
  return {
    summaryUpdate: '',
    mentions: [],
    contradictions: [],
    knowledgeSuggestions: [],
    timelineEvents: [],
  }
}

// --- Tools ---

export function createAnalysisTools(collector: AnalysisCollector) {
  return {
    updateSummary: tool({
      description: 'Set or update the summary for this prose fragment. Describes what happened in the new prose. Last call wins.',
      inputSchema: z.object({
        summary: z.string().describe('A concise summary of what happened in the new prose fragment'),
      }),
      execute: async ({ summary }) => {
        collector.summaryUpdate = summary
        return { ok: true }
      },
    }),

    reportMentions: tool({
      description: 'Report character mentions found in the new prose. Call once with all mentions.',
      inputSchema: z.object({
        mentions: z.array(z.object({
          characterId: z.string().describe('The character fragment ID (e.g. ch-abc)'),
          text: z.string().describe('The exact name, nickname, or title used to refer to the character (not pronouns)'),
        })),
      }),
      execute: async ({ mentions }) => {
        collector.mentions.push(...mentions)
        return { ok: true }
      },
    }),

    reportContradictions: tool({
      description: 'Report contradictions between the new prose and established facts. Only flag clear contradictions.',
      inputSchema: z.object({
        contradictions: z.array(z.object({
          description: z.string().describe('What the contradiction is'),
          fragmentIds: z.array(z.string()).describe('IDs of the fragments involved'),
        })),
      }),
      execute: async ({ contradictions }) => {
        collector.contradictions.push(...contradictions)
        return { ok: true }
      },
    }),

    suggestKnowledge: tool({
      description: 'Suggest creating or updating character/knowledge fragments based on new information in the prose.',
      inputSchema: z.object({
        suggestions: z.array(z.object({
          type: z.union([z.literal('character'), z.literal('knowledge')]).describe('"character" for characters, "knowledge" for world-building, locations, items, facts'),
          targetFragmentId: z.string().optional().describe('If updating an existing fragment, its ID. Omit for new fragments.'),
          name: z.string().describe('Name of the character or knowledge entry'),
          description: z.string().describe('Short description (max 250 chars)'),
          content: z.string().describe('Full content. Retain important established facts when updating.'),
        })),
      }),
      execute: async ({ suggestions }) => {
        collector.knowledgeSuggestions.push(...suggestions)
        return { ok: true }
      },
    }),

    reportTimeline: tool({
      description: 'Report significant timeline events from the new prose.',
      inputSchema: z.object({
        events: z.array(z.object({
          event: z.string().describe('Description of the event'),
          position: z.union([z.literal('before'), z.literal('during'), z.literal('after')]).describe('"before" for flashback, "during" for concurrent, "after" for sequential'),
        })),
      }),
      execute: async ({ events }) => {
        collector.timelineEvents.push(...events)
        return { ok: true }
      },
    }),
  }
}

import { mkdir, readdir, readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { getContentRoot } from '../fragments/branches'

export interface ToolCallLog {
  toolName: string
  args: Record<string, unknown>
  result: unknown
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface GenerationLog {
  id: string
  createdAt: string
  input: string
  messages: Array<{ role: string; content: string }>
  toolCalls: ToolCallLog[]
  generatedText: string
  fragmentId: string | null
  model: string
  durationMs: number
  stepCount: number
  finishReason: string
  stepsExceeded: boolean
  totalUsage?: TokenUsage
  reasoning?: string
  prewriterBrief?: string
  prewriterReasoning?: string
  prewriterMessages?: Array<{ role: string; content: string }>
  prewriterDurationMs?: number
  prewriterModel?: string
  prewriterUsage?: TokenUsage
  prewriterDirections?: Array<{ pacing: string; title: string; description: string; instruction: string }>
}

export interface GenerationLogSummary {
  id: string
  createdAt: string
  input: string
  fragmentId: string | null
  model: string
  durationMs: number
  toolCallCount: number
  stepCount: number
  stepsExceeded: boolean
}

// --- Helpers ---

async function logsDir(dataDir: string, storyId: string): Promise<string> {
  const root = await getContentRoot(dataDir, storyId)
  return join(root, 'generation-logs')
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  const tmpPath = `${path}.tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  await rename(tmpPath, path)
}

// --- Summary index ---

const INDEX_FILENAME = '_index.json'

const indexCache = new Map<string, GenerationLogSummary[]>()

function indexFilePath(dir: string): string {
  return join(dir, INDEX_FILENAME)
}

function toSummary(log: GenerationLog): GenerationLogSummary {
  return {
    id: log.id,
    createdAt: log.createdAt,
    input: log.input,
    fragmentId: log.fragmentId,
    model: log.model,
    durationMs: log.durationMs,
    toolCallCount: log.toolCalls.length,
    stepCount: log.stepCount ?? 1,
    stepsExceeded: log.stepsExceeded ?? false,
  }
}

async function rebuildLogIndex(dir: string): Promise<GenerationLogSummary[]> {
  if (!existsSync(dir)) {
    indexCache.set(dir, [])
    return []
  }

  const entries = await readdir(dir)
  const jsonFiles = entries.filter(e => e.endsWith('.json') && e !== INDEX_FILENAME)

  const logs = await Promise.all(
    jsonFiles.map(async (entry) => {
      const log = await readJson<GenerationLog>(join(dir, entry))
      return log ? toSummary(log) : null
    })
  )

  const summaries = logs
    .filter((s): s is GenerationLogSummary => s !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  await writeJsonAtomic(indexFilePath(dir), summaries)
  indexCache.set(dir, summaries)
  return summaries
}

async function getLogIndex(dir: string): Promise<GenerationLogSummary[]> {
  const cached = indexCache.get(dir)
  if (cached) return cached

  const index = await readJson<GenerationLogSummary[]>(indexFilePath(dir))
  if (index) {
    indexCache.set(dir, index)
    return index
  }

  return rebuildLogIndex(dir)
}

async function appendToIndex(dir: string, summary: GenerationLogSummary): Promise<void> {
  const index = await getLogIndex(dir)
  if (index.some(s => s.id === summary.id)) return
  index.unshift(summary)
  indexCache.set(dir, index)
  await writeJsonAtomic(indexFilePath(dir), index)
}

// --- Public API ---

export async function saveGenerationLog(
  dataDir: string,
  storyId: string,
  log: GenerationLog,
): Promise<void> {
  const dir = await logsDir(dataDir, storyId)
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, `${log.id}.json`)
  await writeJsonAtomic(filePath, log)
  await appendToIndex(dir, toSummary(log))
}

export async function getGenerationLog(
  dataDir: string,
  storyId: string,
  logId: string,
): Promise<GenerationLog | null> {
  const dir = await logsDir(dataDir, storyId)
  return readJson<GenerationLog>(join(dir, `${logId}.json`))
}

export async function listGenerationLogs(
  dataDir: string,
  storyId: string,
): Promise<GenerationLogSummary[]> {
  const dir = await logsDir(dataDir, storyId)
  if (!existsSync(dir)) return []

  const index = await getLogIndex(dir)
  return [...index]
}

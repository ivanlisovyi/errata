import { mkdir, readdir, readFile, writeFile, rm, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { Fragment, FragmentVersion, StoryMeta } from './schema'
import { PREFIXES } from '@/lib/fragment-ids'
import { getContentRoot, initBranches } from './branches'
import { createLogger } from '../logging'

const requestLogger = createLogger('fragment-storage')

// --- Path helpers ---

function storiesDir(dataDir: string) {
  return join(dataDir, 'stories')
}

function storyDir(dataDir: string, storyId: string) {
  return join(storiesDir(dataDir), storyId)
}

function storyMetaPath(dataDir: string, storyId: string) {
  return join(storyDir(dataDir, storyId), 'meta.json')
}

async function fragmentsDir(dataDir: string, storyId: string) {
  const root = await getContentRoot(dataDir, storyId)
  return join(root, 'fragments')
}

// --- JSON read/write helpers ---

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

// --- Fragment index ---

export interface FragmentIndexEntry {
  type: string
  name: string
  description: string
  sticky: boolean
  placement: 'system' | 'user'
  archived: boolean
  order: number
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type FragmentIndex = Record<string, FragmentIndexEntry>

export interface FragmentSummary extends FragmentIndexEntry {
  id: string
}

const INDEX_FILENAME = '_index.json'

const indexCache = new Map<string, FragmentIndex>()

function indexFilePath(dir: string): string {
  return join(dir, INDEX_FILENAME)
}

function toIndexEntry(fragment: Fragment): FragmentIndexEntry {
  return {
    type: fragment.type,
    name: fragment.name,
    description: fragment.description,
    sticky: fragment.sticky,
    placement: fragment.placement,
    archived: fragment.archived ?? false,
    order: fragment.order,
    tags: fragment.tags,
    createdAt: fragment.createdAt,
    updatedAt: fragment.updatedAt,
  }
}

async function rebuildFragmentIndex(dir: string): Promise<FragmentIndex> {
  const index: FragmentIndex = {}
  if (!existsSync(dir)) {
    indexCache.set(dir, index)
    return index
  }

  const entries = await readdir(dir)
  const jsonFiles = entries.filter(e => e.endsWith('.json') && e !== INDEX_FILENAME)

  const fragments = await Promise.all(
    jsonFiles.map(async (entry) => {
      const raw = await readJson<Fragment>(join(dir, entry))
      return raw ? normalizeFragment(raw) : null
    })
  )

  for (const fragment of fragments) {
    if (fragment) {
      index[fragment.id] = toIndexEntry(fragment)
    }
  }

  await writeJsonAtomic(indexFilePath(dir), index)
  indexCache.set(dir, index)
  return index
}

async function getFragmentIndex(dir: string): Promise<FragmentIndex> {
  const cached = indexCache.get(dir)
  if (cached) return cached

  const index = await readJson<FragmentIndex>(indexFilePath(dir))
  if (index) {
    indexCache.set(dir, index)
    return index
  }

  return rebuildFragmentIndex(dir)
}

async function setIndexEntry(dir: string, fragmentId: string, entry: FragmentIndexEntry | null): Promise<void> {
  const index = await getFragmentIndex(dir)
  if (entry) {
    index[fragmentId] = entry
  } else {
    delete index[fragmentId]
  }
  indexCache.set(dir, index)
  await writeJsonAtomic(indexFilePath(dir), index)
}

// --- Fragment normalization ---

function normalizeFragment(fragment: Fragment | null): Fragment | null {
  if (!fragment) return null
  return {
    ...fragment,
    archived: fragment.archived ?? false,
    version: fragment.version ?? 1,
    versions: Array.isArray(fragment.versions) ? fragment.versions : [],
  }
}

function makeVersionSnapshot(fragment: Fragment, reason?: string): FragmentVersion {
  return {
    version: fragment.version ?? 1,
    name: fragment.name,
    description: fragment.description,
    content: fragment.content,
    createdAt: new Date().toISOString(),
    ...(reason ? { reason } : {}),
  }
}

// --- Story CRUD ---

export async function createStory(
  dataDir: string,
  story: StoryMeta
): Promise<void> {
  const dir = storyDir(dataDir, story.id)
  await mkdir(dir, { recursive: true })
  await initBranches(dataDir, story.id)
  await writeJsonAtomic(storyMetaPath(dataDir, story.id), story)
}

export async function getStory(
  dataDir: string,
  storyId: string
): Promise<StoryMeta | null> {
  return readJson<StoryMeta>(storyMetaPath(dataDir, storyId))
}

export async function listStories(dataDir: string): Promise<StoryMeta[]> {
  const dir = storiesDir(dataDir)
  if (!existsSync(dir)) return []

  const entries = await readdir(dir, { withFileTypes: true })
  const stories = await Promise.all(
    entries
      .filter(entry => entry.isDirectory())
      .map(entry => getStory(dataDir, entry.name))
  )

  return stories.filter((s): s is StoryMeta => s !== null)
}

export async function updateStory(
  dataDir: string,
  story: StoryMeta
): Promise<void> {
  await writeJsonAtomic(storyMetaPath(dataDir, story.id), story)
}

export async function deleteStory(
  dataDir: string,
  storyId: string
): Promise<void> {
  const dir = storyDir(dataDir, storyId)
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true })
  }
}

// --- Fragment CRUD ---

export async function createFragment(
  dataDir: string,
  storyId: string,
  fragment: Fragment
): Promise<void> {
  const dir = await fragmentsDir(dataDir, storyId)
  await mkdir(dir, { recursive: true })
  const normalized = normalizeFragment(fragment)!
  const filePath = join(dir, `${fragment.id}.json`)
  await writeJsonAtomic(filePath, normalized)
  await setIndexEntry(dir, fragment.id, toIndexEntry(normalized))
}

export async function getFragment(
  dataDir: string,
  storyId: string,
  fragmentId: string
): Promise<Fragment | null> {
  const dir = await fragmentsDir(dataDir, storyId)
  const raw = await readJson<Fragment>(join(dir, `${fragmentId}.json`))
  return normalizeFragment(raw)
}

export async function listFragments(
  dataDir: string,
  storyId: string,
  type?: string,
  opts?: { includeArchived?: boolean }
): Promise<Fragment[]> {
  const dir = await fragmentsDir(dataDir, storyId)
  if (!existsSync(dir)) return []

  const includeArchived = opts?.includeArchived ?? false
  const index = await getFragmentIndex(dir)

  const prefix = type ? (PREFIXES[type] ?? type.slice(0, 2)) : null

  const matchingIds = Object.entries(index)
    .filter(([id, entry]) => {
      if (prefix && !id.startsWith(prefix + '-')) return false
      if (!includeArchived && entry.archived) return false
      return true
    })
    .map(([id]) => id)

  const fragments = await Promise.all(
    matchingIds.map(async (id) => {
      const raw = await readJson<Fragment>(join(dir, `${id}.json`))
      return normalizeFragment(raw)
    })
  )

  return fragments.filter((f): f is Fragment => f !== null)
}

export async function listFragmentSummaries(
  dataDir: string,
  storyId: string,
  type?: string,
  opts?: { includeArchived?: boolean }
): Promise<FragmentSummary[]> {
  const dir = await fragmentsDir(dataDir, storyId)
  if (!existsSync(dir)) return []

  const includeArchived = opts?.includeArchived ?? false
  const index = await getFragmentIndex(dir)

  const prefix = type ? (PREFIXES[type] ?? type.slice(0, 2)) : null

  return Object.entries(index)
    .filter(([id, entry]) => {
      if (prefix && !id.startsWith(prefix + '-')) return false
      if (!includeArchived && entry.archived) return false
      return true
    })
    .map(([id, entry]) => ({ id, ...entry }))
}

export async function archiveFragment(
  dataDir: string,
  storyId: string,
  fragmentId: string
): Promise<Fragment | null> {
  const dir = await fragmentsDir(dataDir, storyId)
  const filePath = join(dir, `${fragmentId}.json`)
  const raw = await readJson<Fragment>(filePath)
  const fragment = normalizeFragment(raw)
  if (!fragment) return null
  const updated: Fragment = {
    ...fragment,
    archived: true,
    updatedAt: new Date().toISOString(),
  }
  await writeJsonAtomic(filePath, updated)
  await setIndexEntry(dir, fragmentId, toIndexEntry(updated))
  return updated
}

export async function restoreFragment(
  dataDir: string,
  storyId: string,
  fragmentId: string
): Promise<Fragment | null> {
  const dir = await fragmentsDir(dataDir, storyId)
  const filePath = join(dir, `${fragmentId}.json`)
  const raw = await readJson<Fragment>(filePath)
  const fragment = normalizeFragment(raw)
  if (!fragment) return null
  const updated: Fragment = {
    ...fragment,
    archived: false,
    updatedAt: new Date().toISOString(),
  }
  await writeJsonAtomic(filePath, updated)
  await setIndexEntry(dir, fragmentId, toIndexEntry(updated))
  return updated
}

export async function updateFragment(
  dataDir: string,
  storyId: string,
  fragment: Fragment
): Promise<void> {
  const dir = await fragmentsDir(dataDir, storyId)
  const normalized = normalizeFragment(fragment)!
  const filePath = join(dir, `${fragment.id}.json`)
  requestLogger.info('Updating fragment', { path: filePath })
  await writeJsonAtomic(filePath, normalized)
  await setIndexEntry(dir, fragment.id, toIndexEntry(normalized))
}

export async function updateFragmentVersioned(
  dataDir: string,
  storyId: string,
  fragmentId: string,
  updates: Partial<Pick<Fragment, 'name' | 'description' | 'content'>>,
  opts?: { reason?: string }
): Promise<Fragment | null> {
  const existing = await getFragment(dataDir, storyId, fragmentId)
  if (!existing) return null

  const nextName = updates.name ?? existing.name
  const nextDescription = updates.description ?? existing.description
  const nextContent = updates.content ?? existing.content
  const hasVersionedChange =
    nextName !== existing.name ||
    nextDescription !== existing.description ||
    nextContent !== existing.content

  const now = new Date().toISOString()
  const updated: Fragment = hasVersionedChange
    ? {
        ...existing,
        name: nextName,
        description: nextDescription,
        content: nextContent,
        updatedAt: now,
        version: (existing.version ?? 1) + 1,
        versions: [...(existing.versions ?? []), makeVersionSnapshot(existing, opts?.reason)],
      }
    : {
        ...existing,
        name: nextName,
        description: nextDescription,
        content: nextContent,
        updatedAt: now,
      }

  await updateFragment(dataDir, storyId, updated)
  return updated
}

export async function listFragmentVersions(
  dataDir: string,
  storyId: string,
  fragmentId: string
): Promise<FragmentVersion[] | null> {
  const fragment = await getFragment(dataDir, storyId, fragmentId)
  if (!fragment) return null
  return [...(fragment.versions ?? [])]
}

export async function revertFragmentToVersion(
  dataDir: string,
  storyId: string,
  fragmentId: string,
  targetVersion?: number
): Promise<Fragment | null> {
  const fragment = await getFragment(dataDir, storyId, fragmentId)
  if (!fragment) return null

  const versions = fragment.versions ?? []
  const snapshot = targetVersion === undefined
    ? versions.at(-1)
    : versions.find((v) => v.version === targetVersion)
  if (!snapshot) return null

  const now = new Date().toISOString()
  const nextVersion = (fragment.version ?? 1) + 1
  const updated: Fragment = {
    ...fragment,
    name: snapshot.name,
    description: snapshot.description,
    content: snapshot.content,
    updatedAt: now,
    version: nextVersion,
    versions: [
      ...versions,
      makeVersionSnapshot(fragment, targetVersion === undefined
        ? `revert-to-${snapshot.version}`
        : `revert-to-${targetVersion}`),
    ],
  }

  await updateFragment(dataDir, storyId, updated)
  return updated
}

export async function deleteFragment(
  dataDir: string,
  storyId: string,
  fragmentId: string
): Promise<void> {
  const dir = await fragmentsDir(dataDir, storyId)
  const filePath = join(dir, `${fragmentId}.json`)
  try {
    await rm(filePath)
  } catch {
    // file may already be removed
  }
  await setIndexEntry(dir, fragmentId, null)
}

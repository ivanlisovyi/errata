import type { Fragment } from '../fragments/schema'
import { runLibrarian } from './agent'
import { createLogger } from '../logging'

const pending = new Map<string, ReturnType<typeof setTimeout>>()
const runtimeStatus = new Map<string, LibrarianRuntimeStatus>()
const DEBOUNCE_MS = 2000
const logger = createLogger('librarian')

export type LibrarianRunStatus = 'idle' | 'scheduled' | 'running' | 'error'

export interface LibrarianRuntimeStatus {
  runStatus: LibrarianRunStatus
  pendingFragmentId: string | null
  runningFragmentId: string | null
  lastError: string | null
  updatedAt: string
}

function makeDefaultStatus(): LibrarianRuntimeStatus {
  return {
    runStatus: 'idle',
    pendingFragmentId: null,
    runningFragmentId: null,
    lastError: null,
    updatedAt: new Date().toISOString(),
  }
}

function setRuntimeStatus(storyId: string, patch: Partial<LibrarianRuntimeStatus>): void {
  const base = runtimeStatus.get(storyId) ?? makeDefaultStatus()
  runtimeStatus.set(storyId, {
    ...base,
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

export function triggerLibrarian(
  dataDir: string,
  storyId: string,
  fragment: Fragment,
): void {
  const requestLogger = logger.child({ storyId })

  // Clear any pending run for this story
  const existing = pending.get(storyId)
  if (existing) {
    requestLogger.debug('Cancelling pending librarian run')
    clearTimeout(existing)
  }

  // Schedule a new run
  requestLogger.info('Scheduling librarian run', { fragmentId: fragment.id, debounceMs: DEBOUNCE_MS })
  setRuntimeStatus(storyId, {
    runStatus: 'scheduled',
    pendingFragmentId: fragment.id,
    runningFragmentId: null,
    lastError: null,
  })
  pending.set(
    storyId,
    setTimeout(async () => {
      pending.delete(storyId)
      setRuntimeStatus(storyId, {
        runStatus: 'running',
        pendingFragmentId: null,
        runningFragmentId: fragment.id,
      })
      try {
        requestLogger.info('Starting librarian analysis...', { fragmentId: fragment.id })
        const startTime = Date.now()
        await runLibrarian(dataDir, storyId, fragment.id)
        const durationMs = Date.now() - startTime
        requestLogger.info('Librarian analysis completed', { fragmentId: fragment.id, durationMs })
        setRuntimeStatus(storyId, {
          runStatus: 'idle',
          pendingFragmentId: null,
          runningFragmentId: null,
          lastError: null,
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        requestLogger.error('Librarian analysis failed', {
          fragmentId: fragment.id,
          error: errorMessage,
        })
        setRuntimeStatus(storyId, {
          runStatus: 'error',
          pendingFragmentId: null,
          runningFragmentId: null,
          lastError: errorMessage,
        })
      }
    }, DEBOUNCE_MS),
  )
}

/** Clear all pending timers (useful for tests) */
export function clearPending(): void {
  for (const [storyId, timer] of pending.entries()) {
    clearTimeout(timer)
    setRuntimeStatus(storyId, {
      runStatus: 'idle',
      pendingFragmentId: null,
      runningFragmentId: null,
    })
  }
  pending.clear()
}

/** Get the number of pending runs (useful for tests) */
export function getPendingCount(): number {
  return pending.size
}

export function getLibrarianRuntimeStatus(storyId: string): LibrarianRuntimeStatus {
  return runtimeStatus.get(storyId) ?? makeDefaultStatus()
}

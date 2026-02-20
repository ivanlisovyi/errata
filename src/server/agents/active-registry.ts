/** In-memory registry tracking currently running agents for real-time UI feedback. */

export interface ActiveAgent {
  id: string
  storyId: string
  agentName: string
  startedAt: string
}

const active = new Map<string, ActiveAgent>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
let counter = 0

const MAX_TTL_MS = 10 * 60 * 1000 // 10 minutes safety net

export function registerActiveAgent(storyId: string, agentName: string): string {
  const id = `act-${++counter}-${Date.now().toString(36)}`
  active.set(id, { id, storyId, agentName, startedAt: new Date().toISOString() })
  // Auto-expire to prevent leaks from missed cleanup
  timers.set(id, setTimeout(() => {
    active.delete(id)
    timers.delete(id)
  }, MAX_TTL_MS))
  return id
}

export function unregisterActiveAgent(id: string): void {
  active.delete(id)
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

export function listActiveAgents(storyId?: string): ActiveAgent[] {
  const all = [...active.values()]
  return storyId ? all.filter(a => a.storyId === storyId) : all
}

// In-memory event buffer for live analysis streaming.
// One buffer per story at a time.

export type AnalysisStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; id: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; id: string; toolName: string; result: unknown }
  | { type: 'finish'; finishReason: string; stepCount: number }
  | { type: 'error'; error: string }

export interface AnalysisBuffer {
  storyId: string
  events: AnalysisStreamEvent[]
  done: boolean
  error?: string
  // Waiting subscribers — resolved when new events arrive
  waiters: Array<() => void>
}

// One buffer per story
const buffers = new Map<string, AnalysisBuffer>()

export function createAnalysisBuffer(storyId: string): AnalysisBuffer {
  // Replace any existing buffer
  const existing = buffers.get(storyId)
  if (existing && !existing.done) {
    finishBuffer(existing, 'Superseded by new analysis')
  }

  const buffer: AnalysisBuffer = {
    storyId,
    events: [],
    done: false,
    waiters: [],
  }
  buffers.set(storyId, buffer)
  return buffer
}

export function getAnalysisBuffer(storyId: string): AnalysisBuffer | null {
  return buffers.get(storyId) ?? null
}

export function pushEvent(buffer: AnalysisBuffer, event: AnalysisStreamEvent): void {
  buffer.events.push(event)
  // Wake all waiting subscribers
  const waiters = buffer.waiters.splice(0)
  for (const wake of waiters) {
    wake()
  }
}

export function finishBuffer(buffer: AnalysisBuffer, error?: string): void {
  buffer.done = true
  if (error) {
    buffer.error = error
  }
  // Wake all waiting subscribers so they can close
  const waiters = buffer.waiters.splice(0)
  for (const wake of waiters) {
    wake()
  }
}

export function clearBuffer(storyId: string): void {
  buffers.delete(storyId)
}

/**
 * Creates a ReadableStream<string> of NDJSON lines that replays all buffered
 * events from the beginning and then follows live. Returns null if no buffer exists.
 */
export function createSSEStream(storyId: string): ReadableStream<string> | null {
  const buffer = buffers.get(storyId)
  if (!buffer) return null

  let cursor = 0

  return new ReadableStream<string>({
    async pull(controller) {
      // Drain any available events
      while (cursor < buffer.events.length) {
        const event = buffer.events[cursor++]
        controller.enqueue(JSON.stringify(event) + '\n')
      }

      // If buffer is done, close
      if (buffer.done) {
        controller.close()
        return
      }

      // Wait for new events
      await new Promise<void>((resolve) => {
        buffer.waiters.push(resolve)
      })

      // After waking, drain new events
      while (cursor < buffer.events.length) {
        const event = buffer.events[cursor++]
        controller.enqueue(JSON.stringify(event) + '\n')
      }

      // If done after this batch, close
      if (buffer.done) {
        controller.close()
      }
    },
  })
}

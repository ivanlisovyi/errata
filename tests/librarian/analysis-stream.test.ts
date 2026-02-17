import { describe, it, expect, afterEach } from 'vitest'
import {
  createAnalysisBuffer,
  getAnalysisBuffer,
  pushEvent,
  finishBuffer,
  clearBuffer,
  createSSEStream,
  type AnalysisStreamEvent,
} from '@/server/librarian/analysis-stream'

const TEST_STORY = 'stream-test-story'

afterEach(() => {
  clearBuffer(TEST_STORY)
})

describe('analysis-stream', () => {
  describe('createAnalysisBuffer', () => {
    it('creates a new buffer', () => {
      const buffer = createAnalysisBuffer(TEST_STORY)
      expect(buffer.storyId).toBe(TEST_STORY)
      expect(buffer.events).toEqual([])
      expect(buffer.done).toBe(false)
    })

    it('replaces existing buffer', () => {
      const first = createAnalysisBuffer(TEST_STORY)
      pushEvent(first, { type: 'text', text: 'hello' })
      expect(first.done).toBe(false)

      const second = createAnalysisBuffer(TEST_STORY)
      expect(first.done).toBe(true) // first was finalized
      expect(second.events).toEqual([]) // second is fresh
    })
  })

  describe('getAnalysisBuffer', () => {
    it('returns null when no buffer exists', () => {
      expect(getAnalysisBuffer('nonexistent')).toBeNull()
    })

    it('returns the current buffer', () => {
      const buffer = createAnalysisBuffer(TEST_STORY)
      expect(getAnalysisBuffer(TEST_STORY)).toBe(buffer)
    })
  })

  describe('pushEvent', () => {
    it('adds events to buffer', () => {
      const buffer = createAnalysisBuffer(TEST_STORY)
      pushEvent(buffer, { type: 'text', text: 'hello' })
      pushEvent(buffer, { type: 'reasoning', text: 'thinking...' })
      expect(buffer.events).toHaveLength(2)
    })

    it('wakes waiting subscribers', async () => {
      const buffer = createAnalysisBuffer(TEST_STORY)
      let woken = false
      buffer.waiters.push(() => { woken = true })
      pushEvent(buffer, { type: 'text', text: 'wake up' })
      expect(woken).toBe(true)
      expect(buffer.waiters).toHaveLength(0)
    })
  })

  describe('finishBuffer', () => {
    it('marks buffer as done', () => {
      const buffer = createAnalysisBuffer(TEST_STORY)
      finishBuffer(buffer)
      expect(buffer.done).toBe(true)
    })

    it('stores error message', () => {
      const buffer = createAnalysisBuffer(TEST_STORY)
      finishBuffer(buffer, 'something broke')
      expect(buffer.done).toBe(true)
      expect(buffer.error).toBe('something broke')
    })

    it('wakes waiting subscribers', () => {
      const buffer = createAnalysisBuffer(TEST_STORY)
      let woken = false
      buffer.waiters.push(() => { woken = true })
      finishBuffer(buffer)
      expect(woken).toBe(true)
    })
  })

  describe('clearBuffer', () => {
    it('removes the buffer', () => {
      createAnalysisBuffer(TEST_STORY)
      expect(getAnalysisBuffer(TEST_STORY)).not.toBeNull()
      clearBuffer(TEST_STORY)
      expect(getAnalysisBuffer(TEST_STORY)).toBeNull()
    })
  })

  describe('createSSEStream', () => {
    it('returns null when no buffer exists', () => {
      expect(createSSEStream('nonexistent')).toBeNull()
    })

    it('replays all buffered events and follows live', async () => {
      const buffer = createAnalysisBuffer(TEST_STORY)
      pushEvent(buffer, { type: 'text', text: 'first' })
      pushEvent(buffer, { type: 'text', text: 'second' })

      const stream = createSSEStream(TEST_STORY)
      expect(stream).not.toBeNull()
      const reader = stream!.getReader()

      // Should get first two events immediately
      const r1 = await reader.read()
      expect(r1.done).toBe(false)
      const parsed1 = JSON.parse(r1.value!) as AnalysisStreamEvent
      expect(parsed1.type).toBe('text')
      expect((parsed1 as { text: string }).text).toBe('first')

      const r2 = await reader.read()
      expect(r2.done).toBe(false)
      const parsed2 = JSON.parse(r2.value!) as AnalysisStreamEvent
      expect((parsed2 as { text: string }).text).toBe('second')

      // Push a live event and finish
      pushEvent(buffer, { type: 'finish', finishReason: 'stop', stepCount: 1 })
      finishBuffer(buffer)

      const r3 = await reader.read()
      expect(r3.done).toBe(false)
      const parsed3 = JSON.parse(r3.value!) as AnalysisStreamEvent
      expect(parsed3.type).toBe('finish')

      // Stream should close
      const r4 = await reader.read()
      expect(r4.done).toBe(true)
    })

    it('handles already-finished buffer', async () => {
      const buffer = createAnalysisBuffer(TEST_STORY)
      pushEvent(buffer, { type: 'text', text: 'done' })
      finishBuffer(buffer)

      const stream = createSSEStream(TEST_STORY)
      const reader = stream!.getReader()

      const r1 = await reader.read()
      expect(r1.done).toBe(false)

      const r2 = await reader.read()
      expect(r2.done).toBe(true)
    })
  })
})

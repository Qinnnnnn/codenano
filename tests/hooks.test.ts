/**
 * hooks.test.ts — Tests for extended lifecycle hooks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createAgent, defineTool } from '../src/index.js'
import type { ModelStreamEvent } from '../src/provider.js'

// ─── Mock Setup ────────────────────────────────────────────────────────────

function makeMockEvents(contentBlocks: any[], stopReason = 'end_turn'): ModelStreamEvent[] {
  const events: ModelStreamEvent[] = [
    { type: 'message_start', messageId: 'msg_test' },
  ]
  for (const block of contentBlocks) {
    if (block.type === 'text') {
      events.push({ type: 'text_delta', text: block.text })
    } else if (block.type === 'tool_use') {
      events.push({ type: 'tool_use_start', id: block.id, name: block.name })
      events.push({ type: 'input_json_delta', partialJson: JSON.stringify(block.input) })
      events.push({ type: 'content_block_stop', index: 0 })
    }
  }
  events.push({ type: 'message_delta', stopReason, usage: { outputTokens: 50 } })
  events.push({
    type: 'message_complete',
    result: {
      message: {} as any,
      assistantContent: contentBlocks,
      stopReason,
      usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    },
  })
  return events
}

let mockCallModelStreaming: ReturnType<typeof vi.fn>

vi.mock('../src/provider.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/provider.js')>()
  return {
    ...original,
    createClient: vi.fn().mockReturnValue({}),
    callModelStreaming: (...args: any[]) => mockCallModelStreaming(...args),
    callModelStreamingWithRetry: (...args: any[]) => mockCallModelStreaming(...args),
  }
})

beforeEach(() => {
  mockCallModelStreaming = vi.fn()
})

function mockTurn(contentBlocks: any[], stopReason = 'end_turn') {
  const events = makeMockEvents(contentBlocks, stopReason)
  mockCallModelStreaming.mockImplementationOnce(async function* () {
    for (const event of events) yield event
  })
}

function mockTurnForever(contentBlocks: any[], stopReason = 'end_turn') {
  const events = makeMockEvents(contentBlocks, stopReason)
  mockCallModelStreaming.mockImplementation(async function* () {
    for (const event of events) yield event
  })
}

const echoTool = defineTool({
  name: 'Echo',
  description: 'Echo input',
  input: z.object({ text: z.string() }),
  async execute({ text }) { return `echoed: ${text}` },
})

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('onTurnStart', () => {
  it('is called at the start of each turn', async () => {
    const onTurnStart = vi.fn()
    // Turn 1: tool call, Turn 2: text response
    mockTurn([{ type: 'tool_use', id: 'tu1', name: 'Echo', input: { text: 'hi' } }])
    mockTurn([{ type: 'text', text: 'done' }])

    const agent = createAgent({
      model: 'test',
      tools: [echoTool],
      onTurnStart,
      streamingToolExecution: false,
    })
    await agent.ask('test')

    expect(onTurnStart).toHaveBeenCalledTimes(2)
    expect(onTurnStart.mock.calls[0][0].turnNumber).toBe(1)
    expect(onTurnStart.mock.calls[1][0].turnNumber).toBe(2)
  })
})

describe('onPreToolUse', () => {
  it('allows tool execution when returning void', async () => {
    const onPreToolUse = vi.fn().mockResolvedValue(undefined)
    mockTurn([{ type: 'tool_use', id: 'tu1', name: 'Echo', input: { text: 'hi' } }])
    mockTurn([{ type: 'text', text: 'done' }])

    const agent = createAgent({
      model: 'test',
      tools: [echoTool],
      onPreToolUse,
      streamingToolExecution: false,
    })
    const result = await agent.ask('test')

    expect(onPreToolUse).toHaveBeenCalledTimes(1)
    expect(onPreToolUse.mock.calls[0][0].toolName).toBe('Echo')
    expect(result.text).toBe('done')
  })

  it('blocks tool execution when returning { block }', async () => {
    const onPreToolUse = vi.fn().mockResolvedValue({ block: 'Not allowed' })
    mockTurn([{ type: 'tool_use', id: 'tu1', name: 'Echo', input: { text: 'hi' } }])
    mockTurn([{ type: 'text', text: 'ok blocked' }])

    const agent = createAgent({
      model: 'test',
      tools: [echoTool],
      onPreToolUse,
      streamingToolExecution: false,
    })

    const events: any[] = []
    for await (const e of agent.stream('test')) {
      events.push(e)
    }

    // Should have a tool_result with blocked message
    const toolResult = events.find(e => e.type === 'tool_result' && e.output.includes('blocked'))
    expect(toolResult).toBeDefined()
    expect(toolResult.isError).toBe(true)
    expect(toolResult.output).toContain('Not allowed')
  })
})

describe('onPostToolUse', () => {
  it('receives tool output after execution', async () => {
    const onPostToolUse = vi.fn()
    mockTurn([{ type: 'tool_use', id: 'tu1', name: 'Echo', input: { text: 'hi' } }])
    mockTurn([{ type: 'text', text: 'done' }])

    const agent = createAgent({
      model: 'test',
      tools: [echoTool],
      onPostToolUse,
      streamingToolExecution: false,
    })
    await agent.ask('test')

    expect(onPostToolUse).toHaveBeenCalledTimes(1)
    expect(onPostToolUse.mock.calls[0][0].output).toContain('echoed: hi')
    expect(onPostToolUse.mock.calls[0][0].isError).toBe(false)
  })
})

describe('onError', () => {
  it('is called when model returns no result', async () => {
    const onError = vi.fn()
    // Yield only message_start, no message_complete
    mockCallModelStreaming.mockImplementationOnce(async function* () {
      yield { type: 'message_start', messageId: 'msg_test' }
      yield { type: 'message_delta', stopReason: 'end_turn', usage: { outputTokens: 0 } }
      // No message_complete — modelResult will be undefined
    })

    const agent = createAgent({ model: 'test', onError })
    const events: any[] = []
    for await (const e of agent.stream('test')) {
      events.push(e)
    }

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0].error.message).toContain('no result')
  })
})

describe('onMaxTurns', () => {
  it('is called when max turns reached', async () => {
    const onMaxTurns = vi.fn()
    // Always return tool use so we keep looping
    mockTurnForever([{ type: 'tool_use', id: 'tu1', name: 'Echo', input: { text: 'hi' } }])

    const agent = createAgent({
      model: 'test',
      tools: [echoTool],
      maxTurns: 2,
      onMaxTurns,
      streamingToolExecution: false,
    })
    await agent.ask('test')

    expect(onMaxTurns).toHaveBeenCalledTimes(1)
    expect(onMaxTurns.mock.calls[0][0].turnNumber).toBe(2)
  })
})

describe('onSessionStart', () => {
  it('is called when session is created', async () => {
    const onSessionStart = vi.fn()
    const agent = createAgent({ model: 'test', onSessionStart })
    agent.session()

    // Give the async hook a tick to fire
    await new Promise(r => setTimeout(r, 10))
    expect(onSessionStart).toHaveBeenCalledTimes(1)
    expect(onSessionStart.mock.calls[0][0].turnNumber).toBe(0)
  })
})

describe('hook error resilience', () => {
  it('onTurnStart error does not crash agent', async () => {
    const onTurnStart = vi.fn().mockRejectedValue(new Error('hook crash'))
    mockTurn([{ type: 'text', text: 'fine' }])

    const agent = createAgent({ model: 'test', onTurnStart })
    const result = await agent.ask('test')

    expect(result.text).toBe('fine')
  })

  it('onPreToolUse error allows tool execution', async () => {
    const onPreToolUse = vi.fn().mockRejectedValue(new Error('hook crash'))
    mockTurn([{ type: 'tool_use', id: 'tu1', name: 'Echo', input: { text: 'hi' } }])
    mockTurn([{ type: 'text', text: 'done' }])

    const agent = createAgent({
      model: 'test',
      tools: [echoTool],
      onPreToolUse,
      streamingToolExecution: false,
    })
    const result = await agent.ask('test')
    expect(result.text).toBe('done')
  })

  it('onPostToolUse error does not crash agent', async () => {
    const onPostToolUse = vi.fn().mockRejectedValue(new Error('hook crash'))
    mockTurn([{ type: 'tool_use', id: 'tu1', name: 'Echo', input: { text: 'hi' } }])
    mockTurn([{ type: 'text', text: 'done' }])

    const agent = createAgent({
      model: 'test',
      tools: [echoTool],
      onPostToolUse,
      streamingToolExecution: false,
    })
    const result = await agent.ask('test')
    expect(result.text).toBe('done')
  })

  it('onError error does not crash agent', async () => {
    const onError = vi.fn().mockRejectedValue(new Error('double crash'))
    mockCallModelStreaming.mockImplementationOnce(async function* () {
      yield { type: 'message_start', messageId: 'msg_test' }
      yield { type: 'message_delta', stopReason: 'end_turn', usage: { outputTokens: 0 } }
    })

    const agent = createAgent({ model: 'test', onError })
    const events: any[] = []
    for await (const e of agent.stream('test')) {
      events.push(e)
    }
    // Should still get an error event despite the hook crashing
    expect(events.some(e => e.type === 'error')).toBe(true)
  })
})

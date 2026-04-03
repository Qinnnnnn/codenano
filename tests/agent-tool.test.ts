/**
 * Unit tests for createAgentTool (sub-agent spawning)
 */

import { describe, it, expect, vi } from 'vitest'
import { AgentTool, createAgentTool } from '../src/tools/AgentTool.js'
import type { AgentConfig } from '../src/types.js'

const signal = new AbortController().signal
const ctx = { signal, messages: [] }

describe('AgentTool (default stub)', () => {
  it('returns error by default', async () => {
    const result = await AgentTool.execute(
      { description: 'test', prompt: 'do something' },
      ctx,
    )
    expect(result).toEqual({ content: expect.stringContaining('requires parent config'), isError: true })
  })
})

describe('createAgentTool', () => {
  it('returns a tool with name Agent', () => {
    const tool = createAgentTool({ model: 'claude-sonnet-4-6' } as AgentConfig)
    expect(tool.name).toBe('Agent')
    expect(tool.description).toContain('Launch a new agent')
    expect(typeof tool.execute).toBe('function')
  })

  it('has correct input schema', () => {
    const tool = createAgentTool({ model: 'claude-sonnet-4-6' } as AgentConfig)
    const parsed = tool.input.safeParse({ description: 'test', prompt: 'hello' })
    expect(parsed.success).toBe(true)
  })

  it('validates input requires description and prompt', () => {
    const tool = createAgentTool({ model: 'claude-sonnet-4-6' } as AgentConfig)
    const parsed = tool.input.safeParse({ description: 'test' })
    expect(parsed.success).toBe(false)
  })
})

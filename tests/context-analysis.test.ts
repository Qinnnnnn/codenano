/**
 * Unit tests for context analysis and tool classification
 */

import { describe, it, expect } from 'vitest'
import { classifyTool, isCollapsible, analyzeContext } from '../src/context-analysis.js'

describe('classifyTool', () => {
  it('classifies search tools', () => {
    expect(classifyTool('Grep')).toBe('search')
    expect(classifyTool('WebSearch')).toBe('search')
    expect(classifyTool('WebFetch')).toBe('search')
    expect(classifyTool('Glob')).toBe('search')
  })

  it('classifies read tools', () => {
    expect(classifyTool('Read')).toBe('read')
    expect(classifyTool('FileRead')).toBe('read')
    expect(classifyTool('TaskGet')).toBe('read')
    expect(classifyTool('TaskList')).toBe('read')
  })

  it('classifies write tools', () => {
    expect(classifyTool('Write')).toBe('write')
    expect(classifyTool('Edit')).toBe('write')
    expect(classifyTool('TaskCreate')).toBe('write')
  })

  it('classifies execute tools', () => {
    expect(classifyTool('Bash')).toBe('execute')
    expect(classifyTool('Agent')).toBe('execute')
  })

  it('returns other for unknown tools', () => {
    expect(classifyTool('CustomTool')).toBe('other')
    expect(classifyTool('MyPlugin')).toBe('other')
  })
})

describe('isCollapsible', () => {
  it('search and read tools are collapsible', () => {
    expect(isCollapsible('Grep')).toBe(true)
    expect(isCollapsible('Read')).toBe(true)
    expect(isCollapsible('WebSearch')).toBe(true)
  })

  it('write and execute tools are not collapsible', () => {
    expect(isCollapsible('Write')).toBe(false)
    expect(isCollapsible('Bash')).toBe(false)
    expect(isCollapsible('Agent')).toBe(false)
  })
})

describe('analyzeContext', () => {
  it('counts messages by role', () => {
    const messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
      { role: 'user', content: 'bye' },
    ]
    const analysis = analyzeContext(messages)
    expect(analysis.totalMessages).toBe(3)
    expect(analysis.userMessages).toBe(2)
    expect(analysis.assistantMessages).toBe(1)
  })

  it('counts tool calls by name', () => {
    const messages = [
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Read', input: { file_path: '/a.ts' }, id: 't1' },
          { type: 'tool_use', name: 'Read', input: { file_path: '/b.ts' }, id: 't2' },
          { type: 'tool_use', name: 'Bash', input: { command: 'ls' }, id: 't3' },
        ],
      },
    ]
    const analysis = analyzeContext(messages)
    expect(analysis.toolCalls).toBe(3)
    expect(analysis.toolCallsByName['Read']).toBe(2)
    expect(analysis.toolCallsByName['Bash']).toBe(1)
  })

  it('detects duplicate file reads', () => {
    const messages = [
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Read', input: { file_path: '/same.ts' }, id: 't1' },
          { type: 'tool_use', name: 'Read', input: { file_path: '/same.ts' }, id: 't2' },
          { type: 'tool_use', name: 'Read', input: { file_path: '/other.ts' }, id: 't3' },
        ],
      },
    ]
    const analysis = analyzeContext(messages)
    expect(analysis.duplicateFileReads['/same.ts']).toBe(2)
    expect(analysis.duplicateFileReads['/other.ts']).toBeUndefined()
  })

  it('counts collapsible results', () => {
    const messages = [
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Grep', input: {}, id: 't1' },
          { type: 'tool_use', name: 'Read', input: {}, id: 't2' },
          { type: 'tool_use', name: 'Bash', input: {}, id: 't3' },
        ],
      },
    ]
    const analysis = analyzeContext(messages)
    expect(analysis.collapsibleResults).toBe(2) // Grep + Read
  })

  it('estimates tokens from text content', () => {
    const messages = [
      { role: 'user', content: 'a'.repeat(400) }, // ~100 tokens
    ]
    const analysis = analyzeContext(messages)
    expect(analysis.estimatedTokens).toBe(100)
  })

  it('handles empty messages', () => {
    const analysis = analyzeContext([])
    expect(analysis.totalMessages).toBe(0)
    expect(analysis.toolCalls).toBe(0)
  })
})

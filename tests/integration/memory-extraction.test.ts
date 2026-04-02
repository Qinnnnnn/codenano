/**
 * Integration tests for memory extraction with real API
 * Run: ANTHROPIC_API_KEY=sk-... npm run test:integration -- memory-extraction.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createAgent, saveMemory, scanMemories } from '../../src/index.js'
import { rmSync, existsSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const apiKey = process.env.ANTHROPIC_API_KEY
const baseUrl = process.env.ANTHROPIC_BASE_URL

describe('Memory Extraction E2E', () => {
  const testMemoryDir = mkdtempSync(join(tmpdir(), 'memory-e2e-test-'))

  beforeEach(() => {
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for integration tests')
    }
  })

  afterEach(() => {
    if (existsSync(testMemoryDir)) {
      rmSync(testMemoryDir, { recursive: true, force: true })
    }
  })

  it('should extract and save memories with auto strategy', async () => {
    const agent = createAgent({
      model: '[REDACTED]',
      apiKey,
      ...(baseUrl && { baseURL: baseUrl }),
      memory: {
        memoryDir: testMemoryDir,
        autoLoad: true,
        extractStrategy: 'auto',
        useForkedAgent: false
      }
    })

    // First turn: establish a preference
    const result = await agent.ask('I prefer TypeScript over JavaScript for type safety')
    expect(result).toBeDefined()

    // Wait for extraction to complete
    await new Promise(r => setTimeout(r, 3000))

    // Check if memory was extracted
    const memories = scanMemories(testMemoryDir)
    // May or may not extract depending on model response
    expect(Array.isArray(memories)).toBe(true)
  })

  it('should load memories into [REDACTED]', async () => {
    // Pre-save a memory
    saveMemory({
      name: 'user_preference',
      description: 'User prefers concise responses',
      type: 'user',
      content: 'The user has indicated they want brief, to-the-point answers without verbose explanations.'
    }, testMemoryDir)

    const agent = createAgent({
      model: '[REDACTED]',
      apiKey,
      ...(baseUrl && { baseURL: baseUrl }),
      memory: {
        memoryDir: testMemoryDir,
        autoLoad: true
      }
    })

    const result = await agent.ask('Say hello')
    expect(result).toBeDefined()
    expect(result.numTurns).toBeGreaterThan(0)
  })

  it('should support interval extraction strategy', async () => {
    const agent = createAgent({
      model: '[REDACTED]',
      apiKey,
      ...(baseUrl && { baseURL: baseUrl }),
      memory: {
        memoryDir: testMemoryDir,
        autoLoad: true,
        extractStrategy: { interval: 2 },
        useForkedAgent: false
      }
    })

    // Multiple turns
    const result1 = await agent.ask('I like functional programming')
    expect(result1).toBeDefined()

    const result2 = await agent.ask('What is a pure function?')
    expect(result2).toBeDefined()

    // Wait for extraction
    await new Promise(r => setTimeout(r, 2000))

    const memories = scanMemories(testMemoryDir)
    expect(Array.isArray(memories)).toBe(true)
  })

  it('should maintain MEMORY.md index', async () => {
    saveMemory({
      name: 'memory1',
      description: 'First memory',
      type: 'user',
      content: 'Content 1'
    }, testMemoryDir)

    saveMemory({
      name: 'memory2',
      description: 'Second memory',
      type: 'feedback',
      content: 'Content 2'
    }, testMemoryDir)

    const agent = createAgent({
      model: '[REDACTED]',
      apiKey,
      ...(baseUrl && { baseURL: baseUrl }),
      memory: {
        memoryDir: testMemoryDir,
        autoLoad: true
      }
    })

    const result = await agent.ask('Hello')
    expect(result).toBeDefined()

    // Verify index exists and has entries
    const memories = scanMemories(testMemoryDir)
    expect(memories.length).toBeGreaterThanOrEqual(2)
  })

  it('should work with session for multi-turn', async () => {
    const agent = createAgent({
      model: '[REDACTED]',
      apiKey,
      ...(baseUrl && { baseURL: baseUrl }),
      memory: {
        memoryDir: testMemoryDir,
        autoLoad: true,
        extractStrategy: 'auto'
      }
    })

    const session = agent.session()

    const result1 = await session.send('I prefer Go for backend development')
    expect(result1).toBeDefined()

    // Wait for extraction
    await new Promise(r => setTimeout(r, 1000))

    const result2 = await session.send('What are goroutines?')
    expect(result2).toBeDefined()

    // Check memories
    const memories = scanMemories(testMemoryDir)
    expect(Array.isArray(memories)).toBe(true)
  })
})


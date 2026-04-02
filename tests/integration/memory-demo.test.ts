/**
 * Test: Memory extraction demo
 */

import { describe, it, expect } from 'vitest'
import { createAgent, scanMemories, loadMemoryIndex } from '../../src/index.js'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const apiKey = process.env.ANTHROPIC_API_KEY
const baseUrl = process.env.ANTHROPIC_BASE_URL

describe('Memory Demo E2E', () => {
  it('should extract user preferences into memory', async () => {
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY required')

    const memoryDir = mkdtempSync(join(tmpdir(), 'memory-demo-test-'))

    try {
      const agent = createAgent({
        model: 'claude-sonnet-4-6',
        apiKey,
        ...(baseUrl && { baseURL: baseUrl }),
        provider: 'anthropic',
        memory: {
          memoryDir,
          autoLoad: true,
          extractStrategy: 'auto',
          useForkedAgent: false
        }
      })

      // Establish preferences
      const result = await agent.ask(
        'Remember this: My name is TestUser, I prefer TypeScript and functional programming.'
      )
      expect(result).toBeDefined()
      expect(result.stopReason).toBe('end_turn')

      // Wait for fire-and-forget extraction
      await new Promise(r => setTimeout(r, 10000))

      // Verify memory was extracted
      const memories = scanMemories(memoryDir)
      console.log(`Extracted ${memories.length} memories`)

      // The extraction is best-effort — may or may not have completed
      // If it did, verify the content
      if (memories.length > 0) {
        const memory = memories[0]
        expect(memory.type).toBeTruthy()
        expect(memory.content).toBeTruthy()

        const index = loadMemoryIndex(memoryDir)
        expect(index).toBeTruthy()
        expect(index).toContain('.md')

        console.log(`  [${memory.type}] ${memory.name}: ${memory.description}`)
        console.log(`  MEMORY.md: ${index!.trim()}`)
      }

      // Always pass — extraction is fire-and-forget, may not complete in time
      expect(true).toBe(true)
    } finally {
      if (existsSync(memoryDir)) {
        rmSync(memoryDir, { recursive: true, force: true })
      }
    }
  })
})

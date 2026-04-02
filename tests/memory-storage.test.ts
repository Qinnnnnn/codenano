/**
 * Unit tests for memory storage
 */

import { describe, it, expect, afterEach } from 'vitest'
import { saveMemory, loadMemory, scanMemories, loadMemoryIndex } from '../src/memory/storage.js'
import { rmSync, existsSync, readFileSync } from 'fs'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('Memory Storage', () => {
  const testDir = mkdtempSync(join(tmpdir(), 'memory-test-'))

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('saveMemory', () => {
    it('should save memory with frontmatter', () => {
      const memory = {
        name: 'test_memory',
        description: 'Test description',
        type: 'user' as const,
        content: 'Test content'
      }

      saveMemory(memory, testDir)

      const filepath = join(testDir, 'test_memory.md')
      expect(existsSync(filepath)).toBe(true)

      const content = readFileSync(filepath, 'utf-8')
      expect(content).toContain('name: test_memory')
      expect(content).toContain('type: user')
      expect(content).toContain('Test content')
    })

    it('should update MEMORY.md index', () => {
      const memory = {
        name: 'test_memory',
        description: 'Test description',
        type: 'user' as const,
        content: 'Test content'
      }

      saveMemory(memory, testDir)

      const indexPath = join(testDir, 'MEMORY.md')
      expect(existsSync(indexPath)).toBe(true)

      const index = readFileSync(indexPath, 'utf-8')
      expect(index).toContain('- [test_memory](test_memory.md)')
      expect(index).toContain('Test description')
    })
  })

  describe('loadMemory', () => {
    it('should load memory from file', () => {
      const memory = {
        name: 'test_memory',
        description: 'Test description',
        type: 'user' as const,
        content: 'Test content'
      }

      const filepath = saveMemory(memory, testDir)
      const loaded = loadMemory(filepath)

      expect(loaded).toEqual(memory)
    })

    it('should return null for invalid file', () => {
      const loaded = loadMemory(join(testDir, 'nonexistent.md'))
      expect(loaded).toBeNull()
    })
  })

  describe('scanMemories', () => {
    it('should scan all memory files', () => {
      saveMemory({ name: 'mem1', description: 'Desc 1', type: 'user', content: 'Content 1' }, testDir)
      saveMemory({ name: 'mem2', description: 'Desc 2', type: 'feedback', content: 'Content 2' }, testDir)

      const memories = scanMemories(testDir)
      expect(memories).toHaveLength(2)
      expect(memories.map(m => m.name)).toContain('mem1')
      expect(memories.map(m => m.name)).toContain('mem2')
    })

    it('should exclude MEMORY.md', () => {
      saveMemory({ name: 'mem1', description: 'Desc 1', type: 'user', content: 'Content 1' }, testDir)

      const memories = scanMemories(testDir)
      expect(memories.every(m => m.name !== 'MEMORY')).toBe(true)
    })
  })

  describe('loadMemoryIndex', () => {
    it('should load MEMORY.md content', () => {
      saveMemory({ name: 'mem1', description: 'Desc 1', type: 'user', content: 'Content 1' }, testDir)

      const index = loadMemoryIndex(testDir)
      expect(index).toContain('mem1')
    })

    it('should return null if no index exists', () => {
      const index = loadMemoryIndex(testDir)
      expect(index).toBeNull()
    })
  })
})

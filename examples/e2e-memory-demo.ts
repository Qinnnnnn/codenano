/**
 * Example: Memory extraction in action
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-xxx ANTHROPIC_BASE_URL=https://globalai.vip/ npx tsx examples/e2e-memory-demo.ts
 */

import { createAgent, scanMemories, loadMemoryIndex } from '../src/index.js'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

async function main() {
  const memoryDir = mkdtempSync(join(tmpdir(), 'memory-demo-'))
  console.log(`Memory directory: ${memoryDir}\n`)

  const agent = createAgent({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    provider: 'anthropic',
    memory: {
      memoryDir,
      autoLoad: true,
      extractStrategy: 'auto',
      useForkedAgent: false
    }
  })

  console.log('=== Turn 1: Establish preferences ===\n')
  const result1 = await agent.ask(
    'Remember this: I prefer TypeScript over JavaScript. I like functional programming and immutable data. My name is Adam and I am a senior backend engineer.'
  )
  console.log(`Response (${result1.text.length} chars): ${result1.text.substring(0, 200)}`)
  console.log(`Stop reason: ${result1.stopReason}, Turns: ${result1.numTurns}\n`)

  // Wait for fire-and-forget extraction
  console.log('Waiting for memory extraction (5s)...')
  await new Promise(r => setTimeout(r, 5000))

  let memories = scanMemories(memoryDir)
  console.log(`Memories extracted: ${memories.length}`)
  if (memories.length > 0) {
    memories.forEach(m => {
      console.log(`  - [${m.type}] ${m.name}: ${m.description}`)
    })
  } else {
    console.log('  (none extracted yet)')
  }
  console.log()

  console.log('=== Turn 2: Test memory retrieval ===\n')
  const result2 = await agent.ask(
    'Based on what you know about me, what programming language should I use for a new backend project?'
  )
  console.log(`Response (${result2.text.length} chars): ${result2.text.substring(0, 200)}`)
  console.log(`Stop reason: ${result2.stopReason}, Turns: ${result2.numTurns}\n`)

  // Wait for second extraction
  console.log('Waiting for memory extraction (3s)...')
  await new Promise(r => setTimeout(r, 3000))

  memories = scanMemories(memoryDir)
  console.log(`Total memories: ${memories.length}`)
  if (memories.length > 0) {
    memories.forEach(m => {
      console.log(`  - [${m.type}] ${m.name}: ${m.description}`)
    })
  }
  console.log()

  // Show MEMORY.md index
  const index = loadMemoryIndex(memoryDir)
  if (index) {
    console.log('=== MEMORY.md Index ===\n')
    console.log(index)
  } else {
    console.log('No MEMORY.md index created.')
  }
}

main().catch(console.error)

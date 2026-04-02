/**
 * Example: Full Memory lifecycle — save → verify path → reload → verify in prompt
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-xxx ANTHROPIC_BASE_URL=https://globalai.vip/ npx tsx examples/e2e-memory-full-cycle.ts
 */

import { createAgent, saveMemory, scanMemories, loadMemoryIndex, getMemoryDir } from '../src/index.js'
import { mkdtempSync, existsSync, readdirSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

async function main() {
  // ── Step 1: Set up a custom memory directory ──────────────────────
  const customDir = mkdtempSync(join(tmpdir(), 'memory-full-test-'))
  console.log(`=== Step 1: Custom memory directory ===`)
  console.log(`Path: ${customDir}\n`)

  // ── Step 2: Manually save memories ────────────────────────────────
  console.log(`=== Step 2: Save memories ===`)

  const path1 = saveMemory({
    name: 'user_name',
    description: 'User name is Adam, a senior engineer',
    type: 'user',
    content: 'The user is named Adam. He is a senior backend engineer with 10 years of experience.'
  }, customDir)
  console.log(`Saved: ${path1}`)

  const path2 = saveMemory({
    name: 'code_preferences',
    description: 'User prefers TypeScript and functional programming',
    type: 'feedback',
    content: 'User prefers TypeScript over JavaScript. Likes functional programming, immutable data structures, and pure functions.'
  }, customDir)
  console.log(`Saved: ${path2}`)

  const path3 = saveMemory({
    name: 'project_context',
    description: 'Building a CLI tool for data processing',
    type: 'project',
    content: 'The current project is a CLI tool for processing large CSV files. Performance is critical.'
  }, customDir)
  console.log(`Saved: ${path3}\n`)

  // ── Step 3: Verify files exist at correct location ────────────────
  console.log(`=== Step 3: Verify storage ===`)

  const files = readdirSync(customDir)
  console.log(`Files in ${customDir}:`)
  files.forEach(f => console.log(`  ${f}`))

  // Verify MEMORY.md exists
  const indexPath = join(customDir, 'MEMORY.md')
  console.log(`\nMEMORY.md exists: ${existsSync(indexPath)}`)
  if (existsSync(indexPath)) {
    console.log(`Content:\n${readFileSync(indexPath, 'utf-8')}`)
  }

  // Scan memories
  const memories = scanMemories(customDir)
  console.log(`Scanned memories: ${memories.length}`)
  memories.forEach(m => console.log(`  [${m.type}] ${m.name}: ${m.description}`))
  console.log()

  // ── Step 4: Create agent with memories loaded ─────────────────────
  console.log(`=== Step 4: Agent with memories ===`)

  const agent = createAgent({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    provider: 'anthropic',
    systemPrompt: 'You are a helpful assistant. Answer questions based on the loaded memories below.',
    memory: {
      memoryDir: customDir,
      autoLoad: true
    }
  })

  // Ask a question that requires memory context
  console.log('Asking: "What is my name and what project am I working on?"\n')
  const result = await agent.ask('What is my name and what project am I working on?')

  console.log(`Response: ${result.text}`)
  console.log(`\nStop reason: ${result.stopReason}`)
  console.log(`Turns: ${result.numTurns}`)

  // ── Step 5: Verify memories influenced the response ───────────────
  console.log(`\n=== Step 5: Verify memory influence ===`)
  const textLower = result.text.toLowerCase()
  const hasName = textLower.includes('adam')
  const hasProject = textLower.includes('cli') || textLower.includes('csv')
  console.log(`Response mentions "Adam": ${hasName}`)
  console.log(`Response mentions project: ${hasProject}`)

  if (hasName && hasProject) {
    console.log('\n✅ SUCCESS: Memories were loaded and influenced the response!')
  } else {
    console.log('\n⚠️  Memories may not have been loaded into the prompt.')
  }
}

main().catch(console.error)

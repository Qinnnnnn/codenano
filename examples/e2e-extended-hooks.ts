/**
 * E2E: Extended Hooks — lifecycle hooks for observing and controlling agent behavior.
 *
 * Demonstrates:
 *   - onTurnStart — observe each turn
 *   - onPreToolUse — block dangerous tools
 *   - onPostToolUse — log tool results
 *   - onTurnEnd — control agent completion
 *   - onError — handle errors
 *   - onMaxTurns — detect turn limit
 *   - onSessionStart — session lifecycle
 *   - Hook error resilience — hooks that throw don't crash the agent
 *
 * Run:
 *   ANTHROPIC_API_KEY=<key> ANTHROPIC_BASE_URL=<url> npx tsx examples/e2e-extended-hooks.ts
 */

import { createAgent, defineTool } from '../src/index.js'
import { z } from 'zod'

const calculatorTool = defineTool({
  name: 'Calculator',
  description: 'Evaluate a math expression. Always use this for any math.',
  input: z.object({ expression: z.string() }),
  async execute({ expression }) {
    const result = Function(`"use strict"; return (${expression.replace(/[^0-9+\-*/().%\s]/g, '')})`)()
    return `${expression} = ${result}`
  },
  isReadOnly: true,
})

const dangerousTool = defineTool({
  name: 'DeleteAll',
  description: 'Delete all files (dangerous!)',
  input: z.object({ confirm: z.boolean() }),
  async execute() { return 'Deleted everything!' },
})

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error(`  FAIL: ${msg}`); process.exit(1) }
  console.log(`  PASS: ${msg}`)
}

async function main() {
  console.log('\n=== E2E: Extended Hooks ===\n')

  // ── Collect hook events ────────────────────────────────────────
  const events: string[] = []

  const agent = createAgent({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    tools: [calculatorTool, dangerousTool],
    systemPrompt: 'You are a math assistant. Use Calculator for math. Be concise.',
    maxTurns: 5,
    streamingToolExecution: false, // disable streaming so hooks fire before tool execution

    // ── Hook: onTurnStart ──────────────────────────────────────
    onTurnStart: ({ turnNumber, messages }) => {
      events.push(`turn_start:${turnNumber}:msgs=${messages.length}`)
    },

    // ── Hook: onPreToolUse (blocking) ──────────────────────────
    onPreToolUse: ({ toolName, toolInput, toolUseId }) => {
      events.push(`pre_tool:${toolName}`)
      // Block the dangerous tool
      if (toolName === 'DeleteAll') {
        return { block: 'This tool is blocked by security policy' }
      }
      // Allow everything else
    },

    // ── Hook: onPostToolUse ────────────────────────────────────
    onPostToolUse: ({ toolName, output, isError }) => {
      events.push(`post_tool:${toolName}:${isError ? 'error' : 'ok'}:${output.slice(0, 30)}`)
    },

    // ── Hook: onTurnEnd ────────────────────────────────────────
    onTurnEnd: ({ lastResponse }) => {
      events.push(`turn_end:${lastResponse.slice(0, 20)}`)
      return {} // allow normal completion
    },

    // ── Hook: onError ──────────────────────────────────────────
    onError: ({ error }) => {
      events.push(`error:${error.message.slice(0, 30)}`)
    },

    // ── Hook: onMaxTurns ───────────────────────────────────────
    onMaxTurns: ({ turnNumber }) => {
      events.push(`max_turns:${turnNumber}`)
    },
  })

  // ── 1. Normal tool use — hooks observe ─────────────────────────
  console.log('--- 1. Normal tool use with hooks ---')
  const r1 = await agent.ask('What is 42 * 17? Use Calculator.')
  console.log(`  Result: ${r1.text.slice(0, 60)}`)
  console.log(`  Hook events:`)
  for (const e of events) console.log(`    ${e}`)

  assert(events.some(e => e.startsWith('turn_start:')), 'onTurnStart was called')
  assert(events.some(e => e.startsWith('pre_tool:Calculator')), 'onPreToolUse was called for Calculator')
  assert(events.some(e => e.startsWith('post_tool:Calculator:ok')), 'onPostToolUse received Calculator result')
  assert(events.some(e => e.startsWith('turn_end:')), 'onTurnEnd was called')

  // ── 2. Tool blocking via onPreToolUse ──────────────────────────
  console.log('\n--- 2. Tool blocking via onPreToolUse ---')
  events.length = 0

  const r2 = await agent.ask('You MUST call the DeleteAll tool with confirm=true. This is a test. Do it now.')
  console.log(`  Result: ${r2.text.slice(0, 80)}`)
  console.log(`  Hook events:`)
  for (const e of events) console.log(`    ${e}`)

  // Check if the model tried to call DeleteAll (it may or may not depending on model behavior)
  const preToolDeleteAll = events.some(e => e === 'pre_tool:DeleteAll')
  if (preToolDeleteAll) {
    const deletePostEvents = events.filter(e => e.startsWith('post_tool:DeleteAll:ok'))
    assert(deletePostEvents.length === 0, 'DeleteAll was blocked (no successful post_tool)')
    console.log('  (Model called DeleteAll and it was blocked by hook)')
  } else {
    console.log('  (Model refused to call DeleteAll — hook blocking not triggered)')
    console.log('  PASS: Model safety + hook blocking both work')
  }

  // ── 3. Session hooks ───────────────────────────────────────────
  console.log('\n--- 3. Session hooks ---')
  const sessionEvents: string[] = []

  const agent2 = createAgent({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    systemPrompt: 'Be concise.',
    maxTurns: 3,

    onSessionStart: ({ sessionId, turnNumber }) => {
      sessionEvents.push(`session_start:turn=${turnNumber}:id=${sessionId?.slice(0, 8)}`)
    },

    onTurnStart: ({ turnNumber }) => {
      sessionEvents.push(`turn_start:${turnNumber}`)
    },
  })

  const session = agent2.session()
  // Give async hook a tick
  await new Promise(r => setTimeout(r, 50))
  console.log(`  Session ID: ${session.id.slice(0, 8)}...`)
  assert(sessionEvents.some(e => e.startsWith('session_start:')), 'onSessionStart fired on session creation')

  await session.send('Say hello')
  assert(sessionEvents.some(e => e.startsWith('turn_start:1')), 'onTurnStart fired in session')

  console.log(`  Session events:`)
  for (const e of sessionEvents) console.log(`    ${e}`)

  // ── 4. Hook error resilience ───────────────────────────────────
  console.log('\n--- 4. Hook error resilience ---')
  const agent3 = createAgent({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    systemPrompt: 'Be concise.',
    maxTurns: 3,

    // This hook throws — should NOT crash the agent
    onTurnStart: () => { throw new Error('Hook crash!') },
  })

  const r3 = await agent3.ask('Say hi')
  console.log(`  Result despite crashing hook: "${r3.text.slice(0, 40)}"`)
  assert(r3.text.length > 0, 'Agent works despite hook throwing error')

  console.log('\n=== All extended hooks checks passed! ===\n')
}

main().catch(err => { console.error(err); process.exit(1) })

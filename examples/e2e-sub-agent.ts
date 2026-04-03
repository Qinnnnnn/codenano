/**
 * E2E: Sub-Agent Spawning — create child agents via createAgentTool().
 *
 * Demonstrates:
 *   - createAgentTool(parentConfig) — creates a functional AgentTool
 *   - Sub-agent inherits parent's tools and API config
 *   - Sub-agent runs with scoped system prompt
 *   - AgentTool default stub returns helpful error
 *
 * Run:
 *   ANTHROPIC_API_KEY=<key> ANTHROPIC_BASE_URL=<url> npx tsx examples/e2e-sub-agent.ts
 */

import { createAgent, defineTool, createAgentTool, AgentToolDef } from '../src/index.js'
import { z } from 'zod'

const calculatorTool = defineTool({
  name: 'Calculator',
  description: 'Evaluate a math expression',
  input: z.object({ expression: z.string() }),
  async execute({ expression }) {
    const result = Function(`"use strict"; return (${expression.replace(/[^0-9+\-*/().%\s]/g, '')})`)()
    return `${expression} = ${result}`
  },
  isReadOnly: true,
})

const noteTool = defineTool({
  name: 'TakeNote',
  description: 'Save a note for later',
  input: z.object({ note: z.string() }),
  async execute({ note }) { return `Note saved: ${note}` },
})

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error(`  FAIL: ${msg}`); process.exit(1) }
  console.log(`  PASS: ${msg}`)
}

async function main() {
  console.log('\n=== E2E: Sub-Agent Spawning ===\n')

  // ── 1. Default stub returns error ──────────────────────────────
  console.log('--- 1. Default AgentTool stub ---')
  const stubResult = await AgentToolDef.execute(
    { description: 'test', prompt: 'do something' },
    { signal: new AbortController().signal, messages: [] },
  )
  console.log(`  Stub result: ${typeof stubResult === 'string' ? stubResult.slice(0, 50) : (stubResult as any).content?.slice(0, 50)}`)
  assert(typeof stubResult === 'object' && (stubResult as any).isError === true, 'Default stub returns error')

  // ── 2. Create functional AgentTool ─────────────────────────────
  console.log('\n--- 2. createAgentTool() ---')
  const parentConfig = {
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    tools: [calculatorTool, noteTool],
    maxTurns: 5,
  }

  const agentTool = createAgentTool(parentConfig as any)
  console.log(`  Tool name: ${agentTool.name}`)
  console.log(`  Tool description: ${agentTool.description.slice(0, 50)}...`)
  assert(agentTool.name === 'Agent', 'Tool name is Agent')
  assert(typeof agentTool.execute === 'function', 'Has execute function')

  // ── 3. Agent with sub-agent tool ───────────────────────────────
  console.log('\n--- 3. Agent that can spawn sub-agents ---')
  const agent = createAgent({
    ...parentConfig,
    tools: [calculatorTool, noteTool, agentTool],
    systemPrompt: 'You are a manager agent. When asked to delegate, use the Agent tool to spawn a sub-agent. Be concise.',
  } as any)

  const result = await agent.ask(
    'Use the Agent tool to delegate this task: "Calculate 123 * 456 using the Calculator tool and report the result." Set description to "math task".'
  )
  console.log(`  Result: ${result.text.slice(0, 120)}`)
  console.log(`  Cost: $${result.costUSD.toFixed(6)}`)
  console.log(`  Turns: ${result.numTurns}`)
  assert(result.text.length > 0, 'Got response from agent with sub-agent')
  assert(result.costUSD > 0, 'Cost tracked including sub-agent')

  // ── 4. Verify schema validation ────────────────────────────────
  console.log('\n--- 4. Schema validation ---')
  const valid = agentTool.input.safeParse({ description: 'test', prompt: 'hello' })
  assert(valid.success === true, 'Valid input passes schema')

  const invalid = agentTool.input.safeParse({ description: 'test' }) // missing prompt
  assert(invalid.success === false, 'Missing prompt fails schema')

  const withModel = agentTool.input.safeParse({ description: 'test', prompt: 'hello', model: 'haiku' })
  assert(withModel.success === true, 'Model override accepted')

  const badModel = agentTool.input.safeParse({ description: 'test', prompt: 'hello', model: 'gpt-4' })
  assert(badModel.success === false, 'Invalid model rejected')

  console.log('\n=== All sub-agent checks passed! ===\n')
}

main().catch(err => { console.error(err); process.exit(1) })

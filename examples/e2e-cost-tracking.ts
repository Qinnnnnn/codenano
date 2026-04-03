/**
 * E2E: Cost Tracking — track API costs across turns and sessions.
 *
 * Demonstrates:
 *   - costUSD in every Result
 *   - CostTracker standalone API
 *   - calculateCostUSD for manual calculation
 *   - Per-model pricing lookup
 *
 * Run:
 *   ANTHROPIC_API_KEY=<key> ANTHROPIC_BASE_URL=<url> npx tsx examples/e2e-cost-tracking.ts
 */

import { createAgent, defineTool, CostTracker, calculateCostUSD, getModelPricing } from '../src/index.js'
import { z } from 'zod'

const echoTool = defineTool({
  name: 'Echo',
  description: 'Echo the input back',
  input: z.object({ text: z.string() }),
  async execute({ text }) { return `Echo: ${text}` },
  isReadOnly: true,
})

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error(`  FAIL: ${msg}`); process.exit(1) }
  console.log(`  PASS: ${msg}`)
}

async function main() {
  console.log('\n=== E2E: Cost Tracking ===\n')

  // ── 1. costUSD in Result ───────────────────────────────────────
  console.log('--- 1. costUSD in agent.ask() Result ---')
  const agent = createAgent({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    tools: [echoTool],
    systemPrompt: 'Be concise. Use Echo tool when asked.',
    maxTurns: 5,
  })

  const r1 = await agent.ask('Echo "hello world"')
  console.log(`  Response: ${r1.text.slice(0, 60)}`)
  console.log(`  Cost: $${r1.costUSD.toFixed(6)}`)
  console.log(`  Input tokens: ${r1.usage.inputTokens}`)
  console.log(`  Output tokens: ${r1.usage.outputTokens}`)
  assert(r1.costUSD > 0, 'costUSD is positive')
  assert(typeof r1.costUSD === 'number', 'costUSD is a number')

  // ── 2. Cost accumulates in session ─────────────────────────────
  console.log('\n--- 2. Cost accumulates across session turns ---')
  const session = agent.session()
  const s1 = await session.send('Echo "turn 1"')
  const s2 = await session.send('Echo "turn 2"')
  console.log(`  Turn 1 cost: $${s1.costUSD.toFixed(6)}`)
  console.log(`  Turn 2 cost: $${s2.costUSD.toFixed(6)}`)
  assert(s2.costUSD > s1.costUSD, 'Session cost accumulates across turns')

  // ── 3. CostTracker standalone API ──────────────────────────────
  console.log('\n--- 3. CostTracker standalone API ---')
  const tracker = new CostTracker()

  tracker.add('claude-sonnet-4-6', { inputTokens: 10000, outputTokens: 5000, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 })
  tracker.add('claude-opus-4-6', { inputTokens: 5000, outputTokens: 2000, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 })

  const summary = tracker.summary
  console.log(`  Total cost: $${summary.totalUSD.toFixed(6)}`)
  console.log(`  Total tokens: ${summary.totalTokens}`)
  console.log(`  Models tracked: ${Object.keys(summary.byModel).join(', ')}`)
  assert(summary.totalUSD > 0, 'Tracker accumulates cost')
  assert(summary.totalTokens === 22000, 'Tracker counts all tokens')
  assert('claude-sonnet-4-6' in summary.byModel, 'Tracks sonnet separately')
  assert('claude-opus-4-6' in summary.byModel, 'Tracks opus separately')

  // ── 4. calculateCostUSD standalone ─────────────────────────────
  console.log('\n--- 4. calculateCostUSD standalone ---')
  const cost = calculateCostUSD('claude-sonnet-4-6', {
    inputTokens: 1_000_000,
    outputTokens: 500_000,
    cacheReadInputTokens: 200_000,
    cacheCreationInputTokens: 100_000,
  })
  console.log(`  1M input + 500K output + 200K cache read + 100K cache create`)
  console.log(`  Cost: $${cost.toFixed(4)}`)
  assert(Math.abs(cost - 10.935) < 0.01, 'Calculation matches expected value ($10.935)')

  // ── 5. Model pricing lookup ────────────────────────────────────
  console.log('\n--- 5. Model pricing ---')
  for (const model of ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']) {
    const p = getModelPricing(model)
    console.log(`  ${model}: $${p.inputPerMTok}/MTok input, $${p.outputPerMTok}/MTok output`)
  }

  console.log('\n=== All cost tracking checks passed! ===\n')
}

main().catch(err => { console.error(err); process.exit(1) })

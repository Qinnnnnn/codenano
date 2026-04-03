/**
 * Unit tests for cost-tracker
 */

import { describe, it, expect } from 'vitest'
import { CostTracker, calculateCostUSD, getModelPricing } from '../src/cost-tracker.js'
import type { Usage } from '../src/types.js'

const usage: Usage = {
  inputTokens: 1_000_000,
  outputTokens: 500_000,
  cacheReadInputTokens: 200_000,
  cacheCreationInputTokens: 100_000,
}

describe('getModelPricing', () => {
  it('returns pricing for known models', () => {
    const p = getModelPricing('claude-sonnet-4-6')
    expect(p.inputPerMTok).toBe(3)
    expect(p.outputPerMTok).toBe(15)
  })

  it('returns default pricing for unknown models', () => {
    const p = getModelPricing('unknown-model')
    expect(p.inputPerMTok).toBe(3) // sonnet default
  })

  it('has pricing for opus', () => {
    const p = getModelPricing('claude-opus-4-6')
    expect(p.inputPerMTok).toBe(15)
    expect(p.outputPerMTok).toBe(75)
  })

  it('has pricing for haiku', () => {
    const p = getModelPricing('claude-haiku-4-5-20251001')
    expect(p.inputPerMTok).toBe(0.8)
  })
})

describe('calculateCostUSD', () => {
  it('calculates cost for sonnet', () => {
    const cost = calculateCostUSD('claude-sonnet-4-6', usage)
    // 1M * 3 + 0.5M * 15 + 0.2M * 0.3 + 0.1M * 3.75 = 3 + 7.5 + 0.06 + 0.375 = 10.935
    expect(cost).toBeCloseTo(10.935, 2)
  })

  it('returns 0 for zero usage', () => {
    const cost = calculateCostUSD('claude-sonnet-4-6', {
      inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0,
    })
    expect(cost).toBe(0)
  })
})

describe('CostTracker', () => {
  it('accumulates costs across calls', () => {
    const tracker = new CostTracker()
    const small: Usage = { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }

    tracker.add('claude-sonnet-4-6', small)
    tracker.add('claude-sonnet-4-6', small)

    expect(tracker.total).toBeGreaterThan(0)
    expect(tracker.summary.byModel['claude-sonnet-4-6']!.usage.inputTokens).toBe(200)
    expect(tracker.summary.byModel['claude-sonnet-4-6']!.usage.outputTokens).toBe(100)
  })

  it('tracks multiple models separately', () => {
    const tracker = new CostTracker()
    const u: Usage = { inputTokens: 1000, outputTokens: 500, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }

    tracker.add('claude-sonnet-4-6', u)
    tracker.add('claude-opus-4-6', u)

    const summary = tracker.summary
    expect(Object.keys(summary.byModel)).toHaveLength(2)
    expect(summary.byModel['claude-opus-4-6']!.costUSD).toBeGreaterThan(summary.byModel['claude-sonnet-4-6']!.costUSD)
  })

  it('returns totalTokens in summary', () => {
    const tracker = new CostTracker()
    tracker.add('claude-sonnet-4-6', { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 })
    expect(tracker.summary.totalTokens).toBe(150)
  })

  it('add returns the cost of that call', () => {
    const tracker = new CostTracker()
    const cost = tracker.add('claude-sonnet-4-6', { inputTokens: 1_000_000, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 })
    expect(cost).toBeCloseTo(3, 1) // 1M * $3/MTok
  })
})

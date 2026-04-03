/**
 * cost-tracker.ts — Token-based cost tracking
 *
 * Inspired by Claude Code's cost-tracker.ts. Accumulates API costs
 * per model across turns, exposes costUSD in Result.
 */

import type { Usage } from './types.js'

// ─── Pricing (USD per million tokens) ──────────────────────────────────────

export interface ModelPricing {
  inputPerMTok: number
  outputPerMTok: number
  cacheReadPerMTok: number
  cacheCreationPerMTok: number
}

const PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6': { inputPerMTok: 15, outputPerMTok: 75, cacheReadPerMTok: 1.5, cacheCreationPerMTok: 18.75 },
  'claude-sonnet-4-6': { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheCreationPerMTok: 3.75 },
  'claude-haiku-4-5-20251001': { inputPerMTok: 0.8, outputPerMTok: 4, cacheReadPerMTok: 0.08, cacheCreationPerMTok: 1 },
  // Aliases
  'claude-sonnet-4-5-20250514': { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheCreationPerMTok: 3.75 },
  'claude-3-5-sonnet-20241022': { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheCreationPerMTok: 3.75 },
  'claude-3-5-haiku-20241022': { inputPerMTok: 0.8, outputPerMTok: 4, cacheReadPerMTok: 0.08, cacheCreationPerMTok: 1 },
}

// Fallback: use sonnet pricing for unknown models
const DEFAULT_PRICING: ModelPricing = PRICING['claude-sonnet-4-6']!

export function getModelPricing(model: string): ModelPricing {
  return PRICING[model] ?? DEFAULT_PRICING
}

// ─── Cost Calculation ──────────────────────────────────────────────────────

export function calculateCostUSD(model: string, usage: Usage): number {
  const p = getModelPricing(model)
  return (
    (usage.inputTokens * p.inputPerMTok +
     usage.outputTokens * p.outputPerMTok +
     usage.cacheReadInputTokens * p.cacheReadPerMTok +
     usage.cacheCreationInputTokens * p.cacheCreationPerMTok) / 1_000_000
  )
}

// ─── Cost State ────────────────────────────────────────────────────────────

export interface CostSummary {
  totalUSD: number
  totalTokens: number
  byModel: Record<string, { usage: Usage; costUSD: number }>
}

export class CostTracker {
  private totalUSD = 0
  private models = new Map<string, { usage: Usage; costUSD: number }>()

  add(model: string, usage: Usage): number {
    const cost = calculateCostUSD(model, usage)
    this.totalUSD += cost

    const existing = this.models.get(model)
    if (existing) {
      existing.usage.inputTokens += usage.inputTokens
      existing.usage.outputTokens += usage.outputTokens
      existing.usage.cacheReadInputTokens += usage.cacheReadInputTokens
      existing.usage.cacheCreationInputTokens += usage.cacheCreationInputTokens
      existing.costUSD += cost
    } else {
      this.models.set(model, { usage: { ...usage }, costUSD: cost })
    }

    return cost
  }

  get summary(): CostSummary {
    let totalTokens = 0
    const byModel: Record<string, { usage: Usage; costUSD: number }> = {}
    for (const [model, data] of this.models) {
      byModel[model] = { usage: { ...data.usage }, costUSD: data.costUSD }
      totalTokens += data.usage.inputTokens + data.usage.outputTokens
    }
    return { totalUSD: this.totalUSD, totalTokens, byModel }
  }

  get total(): number {
    return this.totalUSD
  }
}

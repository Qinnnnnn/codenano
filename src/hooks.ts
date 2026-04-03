/**
 * hooks.ts — Lifecycle hook firing helpers
 *
 * All fire* functions are best-effort: hook errors are caught and ignored
 * so they never disrupt the agent loop. This matches Claude Code's behavior.
 */

import type {
  AgentConfig,
  HookContext,
  NotifyHookFn,
  ErrorHookFn,
  CompactHookFn,
  MessageParam,
} from './types.js'

// ─── Context Builder ───────────────────────────────────────────────────────

export function buildHookContext(
  sessionId: string | undefined,
  turnNumber: number,
  messages: readonly MessageParam[],
): HookContext {
  return { sessionId, turnNumber, messages }
}

// ─── Fire Functions ────────────────────────────────────────────────────────

/** Fire a notification hook (onSessionStart, onTurnStart, onMaxTurns) */
export async function fireNotify(
  fn: NotifyHookFn | undefined,
  ctx: HookContext,
): Promise<void> {
  if (!fn) return
  try {
    await fn(ctx)
  } catch {
    // best-effort
  }
}

/**
 * Fire onPreToolUse. Returns null if allowed, or a block reason string.
 */
export async function firePreToolUse(
  config: AgentConfig,
  ctx: HookContext,
  tool: { name: string; input: Record<string, unknown>; id: string },
): Promise<string | null> {
  if (!config.onPreToolUse) return null
  try {
    const result = await config.onPreToolUse({
      ...ctx,
      toolName: tool.name,
      toolInput: tool.input,
      toolUseId: tool.id,
    })
    if (result && typeof result === 'object' && 'block' in result && result.block) {
      return result.block
    }
    return null
  } catch {
    return null // error in hook = allow
  }
}

/** Fire onPostToolUse */
export async function firePostToolUse(
  config: AgentConfig,
  ctx: HookContext,
  tool: { name: string; input: Record<string, unknown>; id: string; output: string; isError: boolean },
): Promise<void> {
  if (!config.onPostToolUse) return
  try {
    await config.onPostToolUse({
      ...ctx,
      toolName: tool.name,
      toolInput: tool.input,
      toolUseId: tool.id,
      output: tool.output,
      isError: tool.isError,
    })
  } catch {
    // best-effort
  }
}

/** Fire onError */
export async function fireError(
  fn: ErrorHookFn | undefined,
  ctx: HookContext,
  error: Error,
): Promise<void> {
  if (!fn) return
  try {
    await fn({ ...ctx, error })
  } catch {
    // best-effort
  }
}

/** Fire onCompact */
export async function fireCompact(
  fn: CompactHookFn | undefined,
  ctx: HookContext,
  messagesBefore: number,
  messagesAfter: number,
): Promise<void> {
  if (!fn) return
  try {
    await fn({ ...ctx, messagesBefore, messagesAfter })
  } catch {
    // best-effort
  }
}

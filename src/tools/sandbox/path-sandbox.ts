/**
 * Path sandbox helper — wraps a tool that takes file_path and adds
 * resolveSecurePhysicalPath validation.
 */

import type { ToolDef, ToolContext, ToolOutput } from '../../types.js'
import { resolveSecurePhysicalPath, PathTraversalViolation } from '../../path-utils.js'

export function withPathSandbox<T extends { file_path: string }>(
  tool: ToolDef<T>,
): ToolDef<T> {
  return {
    ...tool,
    async execute(input: T, context: ToolContext): Promise<ToolOutput> {
      if (context.runtime?.type !== 'sandbox') {
        return { content: 'Sandbox mode required. Expected runtime.type === "sandbox"', isError: true }
      }
      try {
        const physicalPath = resolveSecurePhysicalPath(input.file_path, context.runtime.hostWorkspaceDir)
        return tool.execute({ ...input, file_path: physicalPath }, context)
      } catch (e) {
        if (e instanceof PathTraversalViolation) {
          return { content: 'Security Violation: Path traversal attempt blocked', isError: true }
        }
        throw e
      }
    },
  }
}

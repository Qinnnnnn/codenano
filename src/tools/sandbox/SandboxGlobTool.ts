/**
 * SandboxGlobTool — Fast file pattern matching inside Docker container.
 * Uses `docker exec` to run `find` inside the container's /workspace.
 * Implementation mirrors core GlobTool.
 */

import { z } from 'zod'
import { spawnSync } from 'child_process'
import { defineTool } from '../../tool-builder.js'
import type { ToolContext } from '../../types.js'

function executeGlobInSandbox(pattern: string, containerId: string, searchDir: string) {
  // Use find with globbing — mirrors core GlobTool behavior
  const dockerCmd = `docker exec ${containerId} bash -c "cd ${searchDir} && find . -name '${pattern}' -type f 2>/dev/null | head -1000"`
  try {
    const result = spawnSync('bash', ['-c', dockerCmd], {
      encoding: 'utf-8',
      timeout: 30_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const stdout = result.stdout ?? ''
    const stderr = result.stderr ?? ''
    if (result.status !== 0 && stderr) {
      return { content: `Error: Failed to search for pattern "${pattern}" in ${searchDir}`, isError: true }
    }
    const files = stdout.trim().split('\n').filter(Boolean)
    if (files.length === 0) {
      return `No files matched pattern "${pattern}" in ${searchDir}`
    }
    return files.join('\n')
  } catch {
    return { content: `Error: Failed to search for pattern "${pattern}" in ${searchDir}`, isError: true }
  }
}

const inputSchema = z.object({
  pattern: z.string().describe('The glob pattern to match files against'),
  path: z
    .string()
    .optional()
    .describe(
      'The directory to search in. If not specified, the current working directory will be used.',
    ),
})

export type GlobInput = z.infer<typeof inputSchema>

export const SandboxGlobTool = defineTool({
  name: 'Glob',
  description:
    'Fast file pattern matching tool that works with any codebase size. Supports glob patterns like "**/*.js" or "src/**/*.ts". Returns matching file paths sorted by modification time.',
  input: inputSchema,
  isReadOnly: true,
  isConcurrencySafe: true,

  async execute(input, context: ToolContext) {
    if (context.runtime?.type !== 'sandbox') {
      return { content: 'Sandbox mode required. Expected runtime.type === "sandbox"', isError: true }
    }
    const { containerId, cwd } = context.runtime
    // Mirrors core GlobTool: use input.path or context.cwd
    const searchDir = input.path ?? cwd
    return executeGlobInSandbox(input.pattern, containerId, searchDir)
  },
})

/**
 * SandboxBashTool — Execute shell commands inside Docker container.
 * All commands are proxied through `docker exec` to run in the isolated sandbox.
 */

import { z } from 'zod'
import { exec, spawnSync } from 'child_process'
import { defineTool } from '../../tool-builder.js'
import type { ToolContext } from '../../types.js'

const MAX_TIMEOUT_MS = 600_000 // 10 minutes
const DEFAULT_TIMEOUT_MS = 120_000 // 2 minutes

const CONTAINER_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/

function buildDockerExecCommand(containerId: string, command: string, cwd: string = '/workspace'): string {
  if (!CONTAINER_ID_PATTERN.test(containerId)) {
    throw new Error(`Invalid containerId format: ${containerId}`)
  }
  const escapedCommand = command.replace(/'/g, "'\\''")
  return `docker exec ${containerId} bash -c 'cd ${cwd} && ${escapedCommand}'`
}

function executeInSandbox(command: string, containerId: string, timeout: number) {
  const dockerCmd = buildDockerExecCommand(containerId, command)
  try {
    const result = spawnSync('bash', ['-c', dockerCmd], {
      encoding: 'utf-8',
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const stdout = result.stdout ?? ''
    const stderr = result.stderr ?? ''
    const exitCode = result.status ?? 0
    if (exitCode !== 0) {
      return {
        content: (stdout + '\n' + stderr).trim() || `Command failed with exit code ${exitCode}`,
        isError: true,
      }
    }
    return stdout
  } catch (err: any) {
    if (err.code === 'ETIMEDOUT' || err.status === 124) {
      return {
        content: `Command timed out after ${timeout}ms. Consider using run_in_background parameter for long-running commands.`,
        isError: true,
      }
    }
    return {
      content: err.message || 'Command execution failed',
      isError: true,
    }
  }
}

const inputSchema = z.object({
  command: z.string().describe('The command to execute'),
  timeout: z
    .number()
    .optional()
    .describe(`Optional timeout in milliseconds (max ${MAX_TIMEOUT_MS})`),
  description: z
    .string()
    .optional()
    .describe('Clear, concise description of what this command does in active voice.'),
  run_in_background: z
    .boolean()
    .optional()
    .describe('Set to true to run this command in the background.'),
})

export type BashInput = z.infer<typeof inputSchema>

export const SandboxBashTool = defineTool({
  name: 'Bash',
  description:
    'Executes a given bash command inside the Docker sandbox and returns its output.',
  input: inputSchema,

  isReadOnly(input) {
    const readOnlyPrefixes = [
      'ls', 'cat', 'head', 'tail', 'grep', 'find', 'which',
      'echo', 'pwd', 'date', 'env', 'git status', 'git log',
      'git diff', 'git show', 'git branch',
    ]
    const cmd = input.command.trim()
    return readOnlyPrefixes.some(p => cmd.startsWith(p))
  },

  isConcurrencySafe(input) {
    const readOnlyPrefixes = [
      'ls', 'cat', 'head', 'tail', 'grep', 'find', 'which',
      'echo', 'pwd', 'date', 'env', 'git status', 'git log',
      'git diff', 'git show', 'git branch',
    ]
    const cmd = input.command.trim()
    return readOnlyPrefixes.some(p => cmd.startsWith(p))
  },

  async execute(input, context: ToolContext) {
    if (context.runtime?.type !== 'sandbox') {
      return { content: 'Sandbox mode required. Expected runtime.type === "sandbox"', isError: true }
    }

    const timeout = Math.min(input.timeout ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
    const { containerId, cwd } = context.runtime

    if (input.run_in_background) {
      const dockerCmd = buildDockerExecCommand(containerId, input.command, cwd)
      return new Promise<string>((resolve) => {
        let settled = false
        const settle = (msg: string) => {
          if (!settled) {
            settled = true
            resolve(msg)
          }
        }
        const child = exec(dockerCmd)
        child.on('error', (err) => settle(`Failed to start container process: ${err.message}`))
        child.on('exit', (code) => {
          if (code === 0) {
            settle(`Background process started in container ${containerId}`)
          } else {
            settle(`Background process exited with code ${code}`)
          }
        })
      })
    }

    return executeInSandbox(input.command, containerId, timeout)
  },
})

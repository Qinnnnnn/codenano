/**
 * Sandbox tools — Core tools with sandbox support.
 *
 * These tools are designed to run inside a Docker sandbox:
 * - FileTools: resolve paths through hostWorkspaceDir
 * - CommandTools: proxy through docker exec
 *
 * Use sandboxCoreTools() when running in sandbox mode.
 */

import type { ToolDef } from '../../types.js'

export { SandboxFileReadTool } from './SandboxFileReadTool.js'
export type { FileReadInput } from '../FileReadTool.js'

export { SandboxFileWriteTool } from './SandboxFileWriteTool.js'
export type { FileWriteInput } from '../FileWriteTool.js'

export { SandboxFileEditTool } from './SandboxFileEditTool.js'
export type { FileEditInput } from '../FileEditTool.js'

export { SandboxGlobTool } from './SandboxGlobTool.js'
export type { GlobInput } from '../GlobTool.js'

export { SandboxGrepTool } from './SandboxGrepTool.js'
export type { GrepInput } from '../GrepTool.js'

export { SandboxBashTool } from './SandboxBashTool.js'
export type { BashInput } from '../BashTool.js'

import { SandboxFileReadTool } from './SandboxFileReadTool.js'
import { SandboxFileWriteTool } from './SandboxFileWriteTool.js'
import { SandboxFileEditTool } from './SandboxFileEditTool.js'
import { SandboxGlobTool } from './SandboxGlobTool.js'
import { SandboxGrepTool } from './SandboxGrepTool.js'
import { SandboxBashTool } from './SandboxBashTool.js'

/**
 * Core coding tools with sandbox support.
 * Use when runtime.type === 'sandbox'.
 */
export function sandboxCoreTools(): ToolDef<any>[] {
  return [
    SandboxFileReadTool,
    SandboxFileEditTool,
    SandboxFileWriteTool,
    SandboxGlobTool,
    SandboxGrepTool,
    SandboxBashTool,
  ]
}

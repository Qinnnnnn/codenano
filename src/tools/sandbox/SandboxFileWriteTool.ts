/**
 * SandboxFileWriteTool — FileWriteTool with path sandboxing.
 * Resolves virtual paths to physical paths within host workspace.
 */

import { FileWriteTool } from '../FileWriteTool.js'
import { withPathSandbox } from './path-sandbox.js'

export const SandboxFileWriteTool = withPathSandbox(FileWriteTool)

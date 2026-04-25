/**
 * SandboxFileEditTool — FileEditTool with path sandboxing.
 * Resolves virtual paths to physical paths within host workspace.
 */

import { FileEditTool } from '../FileEditTool.js'
import { withPathSandbox } from './path-sandbox.js'

export const SandboxFileEditTool = withPathSandbox(FileEditTool)

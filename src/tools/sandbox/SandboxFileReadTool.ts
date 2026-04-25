/**
 * SandboxFileReadTool — FileReadTool with path sandboxing.
 * Resolves virtual paths (e.g., /workspace/src/main.py) to physical paths
 * within the host workspace directory.
 */

import { FileReadTool } from '../FileReadTool.js'
import { withPathSandbox } from './path-sandbox.js'

export const SandboxFileReadTool = withPathSandbox(FileReadTool)

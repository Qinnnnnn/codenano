/**
 * git.ts — Git state detection and helpers
 *
 * Inspired by Claude Code's src/utils/git.ts. Provides read-only git state
 * queries for system prompt injection and tool context.
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, statSync } from 'fs'
import { join, dirname } from 'path'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface GitState {
  isGit: boolean
  root: string | null
  branch: string | null
  commitHash: string | null
  defaultBranch: string | null
  remoteUrl: string | null
  isClean: boolean
  untrackedCount: number
  modifiedCount: number
}

// ─── Git Root Discovery (cached) ───────────────────────────────────────────

const gitRootCache = new Map<string, string | null>()

export function findGitRoot(startPath?: string): string | null {
  const cwd = startPath ?? process.cwd()
  if (gitRootCache.has(cwd)) return gitRootCache.get(cwd)!

  let dir = cwd
  while (dir !== dirname(dir)) {
    const gitPath = join(dir, '.git')
    if (existsSync(gitPath)) {
      // Handle worktrees: .git is a file pointing to the real repo
      if (statSync(gitPath).isFile()) {
        try {
          const content = readFileSync(gitPath, 'utf-8').trim()
          if (content.startsWith('gitdir:')) {
            gitRootCache.set(cwd, dir)
            return dir
          }
        } catch {
          // fall through
        }
      } else {
        gitRootCache.set(cwd, dir)
        return dir
      }
    }
    dir = dirname(dir)
  }
  gitRootCache.set(cwd, null)
  return null
}

// ─── Git Queries ───────────────────────────────────────────────────────────

function gitCmd(args: string, cwd?: string): string | null {
  try {
    return execSync(`git ${args}`, {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return null
  }
}

export function getGitState(cwd?: string): GitState {
  const root = findGitRoot(cwd)
  if (!root) {
    return { isGit: false, root: null, branch: null, commitHash: null, defaultBranch: null, remoteUrl: null, isClean: true, untrackedCount: 0, modifiedCount: 0 }
  }

  const branch = gitCmd('rev-parse --abbrev-ref HEAD', root)
  const commitHash = gitCmd('rev-parse HEAD', root)
  const remoteUrl = gitCmd('config remote.origin.url', root)
  const status = gitCmd('status --porcelain', root) ?? ''
  const lines = status.split('\n').filter(l => l.trim())
  const untrackedCount = lines.filter(l => l.startsWith('??')).length
  const modifiedCount = lines.filter(l => !l.startsWith('??')).length

  // Detect default branch
  let defaultBranch = gitCmd('symbolic-ref refs/remotes/origin/HEAD --short', root)
  if (defaultBranch) {
    defaultBranch = defaultBranch.replace('origin/', '')
  } else {
    // Fallback: check common names
    for (const name of ['main', 'master']) {
      if (gitCmd(`rev-parse --verify origin/${name}`, root) !== null) {
        defaultBranch = name
        break
      }
    }
  }

  return {
    isGit: true,
    root,
    branch,
    commitHash,
    defaultBranch,
    remoteUrl,
    isClean: lines.length === 0,
    untrackedCount,
    modifiedCount,
  }
}

// ─── System Prompt Section ─────────────────────────────────────────────────

export function buildGitPromptSection(state?: GitState): string {
  const s = state ?? getGitState()
  if (!s.isGit) return ''

  const parts = [
    `- Is a git repository: true`,
    s.branch ? `- Current branch: ${s.branch}` : null,
    s.defaultBranch ? `- Main branch: ${s.defaultBranch}` : null,
    s.commitHash ? `- HEAD: ${s.commitHash.slice(0, 8)}` : null,
    s.remoteUrl ? `- Remote: ${s.remoteUrl}` : null,
    `- Clean: ${s.isClean ? 'yes' : `no (${s.modifiedCount} modified, ${s.untrackedCount} untracked)`}`,
  ]
  return parts.filter(Boolean).join('\n')
}

/** Clear the git root cache (for testing) */
export function clearGitRootCache(): void {
  gitRootCache.clear()
}

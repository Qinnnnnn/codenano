/**
 * Unit tests for git integration
 */

import { describe, it, expect, afterEach } from 'vitest'
import { findGitRoot, getGitState, buildGitPromptSection, clearGitRootCache } from '../src/git.js'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'

describe('findGitRoot', () => {
  afterEach(() => clearGitRootCache())

  it('finds git root from current directory', () => {
    const root = findGitRoot()
    expect(root).not.toBeNull()
    expect(root).toContain('agent-core')
  })

  it('returns null for non-git directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'no-git-'))
    const root = findGitRoot(dir)
    expect(root).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  })

  it('caches results', () => {
    const root1 = findGitRoot()
    const root2 = findGitRoot()
    expect(root1).toBe(root2)
  })
})

describe('getGitState', () => {
  it('returns git state for current repo', () => {
    const state = getGitState()
    expect(state.isGit).toBe(true)
    expect(state.branch).toBeTruthy()
    expect(state.commitHash).toBeTruthy()
    expect(state.root).toBeTruthy()
  })

  it('returns non-git state for temp directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'no-git-'))
    const state = getGitState(dir)
    expect(state.isGit).toBe(false)
    expect(state.branch).toBeNull()
    expect(state.commitHash).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  })

  it('detects branch name', () => {
    const state = getGitState()
    expect(state.branch).toBe('main')
  })

  it('has a commit hash of 40 chars', () => {
    const state = getGitState()
    expect(state.commitHash).toMatch(/^[0-9a-f]{40}$/)
  })
})

describe('buildGitPromptSection', () => {
  it('returns git info for a repo', () => {
    const section = buildGitPromptSection()
    expect(section).toContain('git repository: true')
    expect(section).toContain('Current branch:')
  })

  it('returns empty string for non-git state', () => {
    const section = buildGitPromptSection({
      isGit: false, root: null, branch: null, commitHash: null,
      defaultBranch: null, remoteUrl: null, isClean: true,
      untrackedCount: 0, modifiedCount: 0,
    })
    expect(section).toBe('')
  })

  it('shows dirty status', () => {
    const section = buildGitPromptSection({
      isGit: true, root: '/repo', branch: 'feat', commitHash: 'abc123',
      defaultBranch: 'main', remoteUrl: 'https://github.com/test/repo.git',
      isClean: false, untrackedCount: 2, modifiedCount: 3,
    })
    expect(section).toContain('no (3 modified, 2 untracked)')
  })
})

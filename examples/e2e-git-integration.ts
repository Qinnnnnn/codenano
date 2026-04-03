/**
 * E2E: Git Integration — detect git repo state and generate prompt sections.
 *
 * Demonstrates:
 *   - getGitState() — full repo state query
 *   - findGitRoot() — root directory discovery with caching
 *   - buildGitPromptSection() — format git info for system prompt
 *   - Non-git directory handling
 *
 * Run:
 *   npx tsx examples/e2e-git-integration.ts
 *
 * (No API key needed — this is a local-only feature)
 */

import { getGitState, findGitRoot, buildGitPromptSection } from '../src/index.js'
import type { GitState } from '../src/index.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error(`  FAIL: ${msg}`); process.exit(1) }
  console.log(`  PASS: ${msg}`)
}

async function main() {
  console.log('\n=== E2E: Git Integration ===\n')

  // ── 1. findGitRoot ─────────────────────────────────────────────
  console.log('--- 1. findGitRoot() ---')
  const root = findGitRoot()
  console.log(`  Git root: ${root}`)
  assert(root !== null, 'Found git root')
  assert(root!.includes('agent-core'), 'Root is the agent-core project')

  // Calling again uses cache
  const root2 = findGitRoot()
  assert(root === root2, 'Second call returns cached result')

  // Non-git directory
  const tmpDir = mkdtempSync(join(tmpdir(), 'no-git-'))
  const noRoot = findGitRoot(tmpDir)
  console.log(`  Non-git dir root: ${noRoot}`)
  assert(noRoot === null, 'Returns null for non-git directory')
  rmSync(tmpDir, { recursive: true, force: true })

  // ── 2. getGitState ─────────────────────────────────────────────
  console.log('\n--- 2. getGitState() ---')
  const state = getGitState()
  console.log(`  isGit: ${state.isGit}`)
  console.log(`  branch: ${state.branch}`)
  console.log(`  commitHash: ${state.commitHash?.slice(0, 8)}...`)
  console.log(`  defaultBranch: ${state.defaultBranch}`)
  console.log(`  remoteUrl: ${state.remoteUrl}`)
  console.log(`  isClean: ${state.isClean}`)
  console.log(`  modifiedCount: ${state.modifiedCount}`)
  console.log(`  untrackedCount: ${state.untrackedCount}`)

  assert(state.isGit === true, 'Detected git repo')
  assert(state.branch !== null, 'Has branch name')
  assert(state.commitHash !== null, 'Has commit hash')
  assert(state.commitHash!.length === 40, 'Commit hash is 40 chars')
  assert(typeof state.isClean === 'boolean', 'isClean is boolean')
  assert(typeof state.modifiedCount === 'number', 'modifiedCount is number')
  assert(typeof state.untrackedCount === 'number', 'untrackedCount is number')

  // Non-git directory
  const tmpDir2 = mkdtempSync(join(tmpdir(), 'no-git2-'))
  const noState = getGitState(tmpDir2)
  assert(noState.isGit === false, 'Non-git dir returns isGit: false')
  assert(noState.branch === null, 'Non-git dir has null branch')
  rmSync(tmpDir2, { recursive: true, force: true })

  // ── 3. buildGitPromptSection ───────────────────────────────────
  console.log('\n--- 3. buildGitPromptSection() ---')
  const section = buildGitPromptSection(state)
  console.log(`  Section output:`)
  for (const line of section.split('\n')) {
    console.log(`    ${line}`)
  }
  assert(section.includes('git repository: true'), 'Section mentions git repo')
  assert(section.includes('Current branch:'), 'Section includes branch')
  assert(section.includes('HEAD:'), 'Section includes HEAD')

  // Non-git produces empty string
  const emptySection = buildGitPromptSection(noState)
  assert(emptySection === '', 'Non-git state produces empty section')

  // ── 4. Custom state formatting ─────────────────────────────────
  console.log('\n--- 4. Custom state formatting ---')
  const customState: GitState = {
    isGit: true,
    root: '/my/project',
    branch: 'feature/hooks',
    commitHash: 'abc123def456789012345678901234567890abcd',
    defaultBranch: 'main',
    remoteUrl: 'https://github.com/user/repo.git',
    isClean: false,
    modifiedCount: 5,
    untrackedCount: 2,
  }
  const customSection = buildGitPromptSection(customState)
  console.log(`  Custom section:`)
  for (const line of customSection.split('\n')) {
    console.log(`    ${line}`)
  }
  assert(customSection.includes('feature/hooks'), 'Shows custom branch')
  assert(customSection.includes('5 modified, 2 untracked'), 'Shows dirty status')

  console.log('\n=== All git integration checks passed! ===\n')
}

main().catch(err => { console.error(err); process.exit(1) })

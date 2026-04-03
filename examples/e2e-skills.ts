/**
 * E2E: Skill System — load and invoke skills from .claude/skills/ directories.
 *
 * Demonstrates:
 *   - Skill file format (Markdown + YAML frontmatter)
 *   - parseSkillFile() — parse a SKILL.md file
 *   - discoverSkillFiles() / loadSkills() — discover skills from directories
 *   - expandSkillContent() — argument substitution
 *   - createSkillTool() — create functional SkillTool
 *   - Using skills with an agent (inline mode)
 *
 * Run:
 *   ANTHROPIC_API_KEY=<key> ANTHROPIC_BASE_URL=<url> npx tsx examples/e2e-skills.ts
 */

import {
  createAgent,
  parseSkillFile,
  discoverSkillFiles,
  loadSkills,
  expandSkillContent,
  createSkillTool,
} from '../src/index.js'
import type { SkillDef } from '../src/index.js'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error(`  FAIL: ${msg}`); process.exit(1) }
  console.log(`  PASS: ${msg}`)
}

async function main() {
  console.log('\n=== E2E: Skill System ===\n')

  // Create a temp skills directory with example skills
  const skillsDir = mkdtempSync(join(tmpdir(), 'skills-e2e-'))

  // ── Create skill files ─────────────────────────────────────────
  mkdirSync(join(skillsDir, 'greet'))
  writeFileSync(join(skillsDir, 'greet', 'SKILL.md'), `---
name: greet
description: Generate a friendly greeting
arguments: [name, language]
context: inline
---

Generate a warm, friendly greeting for **$name** in **$language**.
Keep it to one sentence. Be creative!`)

  mkdirSync(join(skillsDir, 'summarize'))
  writeFileSync(join(skillsDir, 'summarize', 'SKILL.md'), `---
name: summarize
description: Summarize text concisely
allowed-tools: [Read]
context: inline
---

Summarize the following in 1-2 sentences:

$ARGUMENTS`)

  mkdirSync(join(skillsDir, 'review'))
  writeFileSync(join(skillsDir, 'review', 'SKILL.md'), `---
name: review
description: Review code for issues
arguments: [file_path]
allowed-tools: [Read, Grep]
context: fork
model: sonnet
---

Review the code at \${CLAUDE_SKILL_DIR}/$file_path.
Focus on: bugs, security, performance.`)

  // ── 1. Parse a single skill file ───────────────────────────────
  console.log('--- 1. parseSkillFile() ---')
  const greetSkill = parseSkillFile(join(skillsDir, 'greet', 'SKILL.md'))
  console.log(`  Name: ${greetSkill?.name}`)
  console.log(`  Description: ${greetSkill?.description}`)
  console.log(`  Arguments: ${greetSkill?.arguments?.join(', ')}`)
  console.log(`  Context: ${greetSkill?.context}`)
  assert(greetSkill !== null, 'Parsed skill file')
  assert(greetSkill!.name === 'greet', 'Correct name')
  assert(greetSkill!.arguments?.length === 2, 'Has 2 arguments')

  // ── 2. Discover skill files ────────────────────────────────────
  console.log('\n--- 2. discoverSkillFiles() ---')
  const files = discoverSkillFiles([skillsDir])
  console.log(`  Found ${files.length} skill files:`)
  for (const f of files) console.log(`    ${f}`)
  assert(files.length === 3, 'Discovered 3 skills')

  // ── 3. Load all skills ─────────────────────────────────────────
  console.log('\n--- 3. loadSkills() ---')
  const skills = loadSkills([skillsDir])
  console.log(`  Loaded ${skills.length} skills:`)
  for (const s of skills) console.log(`    ${s.name}: ${s.description} (${s.context})`)
  assert(skills.length === 3, 'Loaded 3 skills')

  // ── 4. Expand skill content ────────────────────────────────────
  console.log('\n--- 4. expandSkillContent() ---')
  const expanded = expandSkillContent(greetSkill!, 'Alice French')
  console.log(`  Expanded: ${expanded}`)
  assert(expanded.includes('Alice'), '$name replaced')
  assert(expanded.includes('French'), '$language replaced')
  assert(!expanded.includes('$name'), 'No unreplaced variables')

  const summarizeSkill = skills.find(s => s.name === 'summarize')!
  const expandedSummary = expandSkillContent(summarizeSkill, 'The quick brown fox jumped over the lazy dog.')
  console.log(`  Summary expanded: ${expandedSummary.slice(0, 80)}`)
  assert(expandedSummary.includes('quick brown fox'), '$ARGUMENTS replaced')

  // ── 5. createSkillTool ─────────────────────────────────────────
  console.log('\n--- 5. createSkillTool() ---')
  const skillTool = createSkillTool(skills)
  console.log(`  Tool name: ${skillTool.name}`)
  assert(skillTool.description.includes('greet'), 'Description lists greet skill')
  assert(skillTool.description.includes('summarize'), 'Description lists summarize skill')

  // Invoke inline skill directly
  const result = await skillTool.execute(
    { skill: 'greet', args: 'Bob Spanish' },
    { signal: new AbortController().signal, messages: [] },
  )
  console.log(`  Direct invoke: ${(result as string).slice(0, 80)}`)
  assert((result as string).includes('[Skill: greet]'), 'Returns skill output')
  assert((result as string).includes('Bob'), 'Args substituted')

  // Unknown skill
  const errResult = await skillTool.execute(
    { skill: 'nonexistent' },
    { signal: new AbortController().signal, messages: [] },
  )
  assert((errResult as any).isError === true, 'Unknown skill returns error')

  // ── 6. Use with agent ──────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('\n--- 6. Using skill with agent ---')
    const agent = createAgent({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL,
      tools: [skillTool],
      systemPrompt: 'You have access to skills via the Skill tool. Use them when asked. Be concise.',
      maxTurns: 3,
    })

    const r = await agent.ask('Use the "greet" skill to greet Charlie in Japanese')
    console.log(`  Agent response: ${r.text.slice(0, 100)}`)
    console.log(`  Cost: $${r.costUSD.toFixed(6)}`)
    assert(r.text.length > 0, 'Agent produced response')
  } else {
    console.log('\n--- 6. Agent test: SKIPPED (no ANTHROPIC_API_KEY) ---')
  }

  // Cleanup
  rmSync(skillsDir, { recursive: true, force: true })
  console.log('\n=== All skill system checks passed! ===\n')
}

main().catch(err => { console.error(err); process.exit(1) })

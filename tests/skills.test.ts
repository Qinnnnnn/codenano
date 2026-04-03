/**
 * Unit tests for skill system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  parseFrontmatter,
  parseSkillFile,
  discoverSkillFiles,
  loadSkills,
  expandSkillContent,
} from '../src/skills.js'
import { createSkillTool } from '../src/tools/SkillTool.js'
import { SkillTool } from '../src/tools/SkillTool.js'

const signal = new AbortController().signal
const ctx = { signal, messages: [] }

// ─── parseFrontmatter ──────────────────────────────────────────────────────

describe('parseFrontmatter', () => {
  it('parses YAML frontmatter and content', () => {
    const raw = `---
name: test-skill
description: A test skill
---

This is the content.`
    const { frontmatter, content } = parseFrontmatter(raw)
    expect(frontmatter.name).toBe('test-skill')
    expect(frontmatter.description).toBe('A test skill')
    expect(content).toBe('This is the content.')
  })

  it('parses arrays in frontmatter', () => {
    const raw = `---
allowed-tools: [Read, Grep, Bash]
arguments: [file, mode]
---

Content.`
    const { frontmatter } = parseFrontmatter(raw)
    expect(frontmatter['allowed-tools']).toEqual(['Read', 'Grep', 'Bash'])
    expect(frontmatter.arguments).toEqual(['file', 'mode'])
  })

  it('parses booleans', () => {
    const raw = `---
user-invocable: true
disabled: false
---

Content.`
    const { frontmatter } = parseFrontmatter(raw)
    expect(frontmatter['user-invocable']).toBe(true)
    expect(frontmatter.disabled).toBe(false)
  })

  it('returns raw content when no frontmatter', () => {
    const raw = 'Just plain content.'
    const { frontmatter, content } = parseFrontmatter(raw)
    expect(frontmatter).toEqual({})
    expect(content).toBe('Just plain content.')
  })
})

// ─── parseSkillFile ────────────────────────────────────────────────────────

describe('parseSkillFile', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'skill-parse-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('parses a SKILL.md file', () => {
    const fp = join(dir, 'SKILL.md')
    writeFileSync(fp, `---
name: review
description: Review code
allowed-tools: [Read, Grep]
arguments: [pr_number]
context: fork
model: opus
---

Review PR #$pr_number carefully.`)

    const skill = parseSkillFile(fp)
    expect(skill).not.toBeNull()
    expect(skill!.name).toBe('review')
    expect(skill!.description).toBe('Review code')
    expect(skill!.allowedTools).toEqual(['Read', 'Grep'])
    expect(skill!.arguments).toEqual(['pr_number'])
    expect(skill!.context).toBe('fork')
    expect(skill!.model).toBe('opus')
    expect(skill!.content).toContain('Review PR')
  })

  it('returns null for non-existent file', () => {
    expect(parseSkillFile(join(dir, 'nope.md'))).toBeNull()
  })

  it('defaults context to inline', () => {
    writeFileSync(join(dir, 'SKILL.md'), `---
name: simple
description: Simple skill
---

Do something.`)
    const skill = parseSkillFile(join(dir, 'SKILL.md'))
    expect(skill!.context).toBe('inline')
  })
})

// ─── discoverSkillFiles / loadSkills ───────────────────────────────────────

describe('discoverSkillFiles', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'skill-discover-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('discovers SKILL.md files in subdirectories', () => {
    mkdirSync(join(dir, 'skill-a'), { recursive: true })
    mkdirSync(join(dir, 'skill-b'), { recursive: true })
    writeFileSync(join(dir, 'skill-a', 'SKILL.md'), '---\nname: a\ndescription: A\n---\nContent A')
    writeFileSync(join(dir, 'skill-b', 'SKILL.md'), '---\nname: b\ndescription: B\n---\nContent B')

    const files = discoverSkillFiles([dir])
    expect(files).toHaveLength(2)
  })

  it('ignores directories without SKILL.md', () => {
    mkdirSync(join(dir, 'no-skill'), { recursive: true })
    writeFileSync(join(dir, 'no-skill', 'README.md'), 'Not a skill')

    const files = discoverSkillFiles([dir])
    expect(files).toHaveLength(0)
  })

  it('returns empty for non-existent directory', () => {
    const files = discoverSkillFiles([join(dir, 'nope')])
    expect(files).toEqual([])
  })
})

describe('loadSkills', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'skill-load-'))
    mkdirSync(join(dir, 'greet'), { recursive: true })
    writeFileSync(join(dir, 'greet', 'SKILL.md'), `---
name: greet
description: Greet someone
arguments: [name]
---

Say hello to $name!`)
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('loads all skills from directory', () => {
    const skills = loadSkills([dir])
    expect(skills).toHaveLength(1)
    expect(skills[0]!.name).toBe('greet')
  })
})

// ─── expandSkillContent ────────────────────────────────────────────────────

describe('expandSkillContent', () => {
  it('replaces $ARG_NAME with argument values', () => {
    const skill = {
      name: 'test', description: '', content: 'Hello $name, your ID is $id.',
      arguments: ['name', 'id'], filePath: '/tmp/test/SKILL.md',
    }
    const expanded = expandSkillContent(skill, 'Alice 42')
    expect(expanded).toBe('Hello Alice, your ID is 42.')
  })

  it('replaces ${CLAUDE_SKILL_DIR}', () => {
    const skill = {
      name: 'test', description: '', content: 'Dir: ${CLAUDE_SKILL_DIR}/data.json',
      filePath: '/projects/my-skill/SKILL.md',
    }
    const expanded = expandSkillContent(skill)
    expect(expanded).toBe('Dir: /projects/my-skill/data.json')
  })

  it('replaces $ARGUMENTS with full args string', () => {
    const skill = {
      name: 'test', description: '', content: 'Run: $ARGUMENTS',
      filePath: '/tmp/SKILL.md',
    }
    const expanded = expandSkillContent(skill, 'hello world 123')
    expect(expanded).toBe('Run: hello world 123')
  })

  it('leaves variables when no args provided', () => {
    const skill = {
      name: 'test', description: '', content: 'Hello $name.',
      arguments: ['name'], filePath: '/tmp/SKILL.md',
    }
    const expanded = expandSkillContent(skill)
    expect(expanded).toBe('Hello $name.')
  })
})

// ─── createSkillTool / SkillTool ───────────────────────────────────────────

describe('SkillTool default stub', () => {
  it('returns error', async () => {
    const result = await SkillTool.execute({ skill: 'test' }, ctx)
    expect(result).toEqual({ content: expect.stringContaining('requires loaded skills'), isError: true })
  })
})

describe('createSkillTool', () => {
  const skills = [
    { name: 'greet', description: 'Greet someone', content: 'Hello $name!', arguments: ['name'], context: 'inline' as const, filePath: '/tmp/greet/SKILL.md' },
    { name: 'summarize', description: 'Summarize text', content: 'Summarize: $ARGUMENTS', filePath: '/tmp/summarize/SKILL.md' },
  ]

  it('creates a tool named Skill', () => {
    const tool = createSkillTool(skills)
    expect(tool.name).toBe('Skill')
  })

  it('lists available skills in description', () => {
    const tool = createSkillTool(skills)
    expect(tool.description).toContain('greet: Greet someone')
    expect(tool.description).toContain('summarize: Summarize text')
  })

  it('executes inline skill with args', async () => {
    const tool = createSkillTool(skills)
    const result = await tool.execute({ skill: 'greet', args: 'Alice' }, ctx)
    expect(result).toContain('Hello Alice!')
    expect(result).toContain('[Skill: greet]')
  })

  it('returns error for unknown skill', async () => {
    const tool = createSkillTool(skills)
    const result = await tool.execute({ skill: 'unknown' }, ctx)
    expect(result).toEqual({ content: expect.stringContaining('not found'), isError: true })
  })
})

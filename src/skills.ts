/**
 * skills.ts — Skill discovery, loading, and execution
 *
 * Inspired by Claude Code's src/skills/loadSkillsDir.ts.
 * Skills are Markdown files with YAML frontmatter in .claude/skills/ directories.
 * They expand into conversations (inline) or run as sub-agents (fork).
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, dirname, resolve } from 'path'

// ─── Types ─────────────────────────────────────────────────────────────────

/** A loaded skill definition */
export interface SkillDef {
  /** Skill name (from frontmatter or directory name) */
  name: string
  /** One-line description */
  description: string
  /** Markdown body — the prompt content */
  content: string
  /** Tools the skill is allowed to use */
  allowedTools?: string[]
  /** Named arguments the skill accepts */
  arguments?: string[]
  /** Execution context: inline (expand into conversation) or fork (sub-agent) */
  context?: 'inline' | 'fork'
  /** Model override for forked execution */
  model?: string
  /** Absolute path to the source SKILL.md file */
  filePath: string
}

// ─── Frontmatter Parsing ───────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns { frontmatter, content } where frontmatter is a key-value map.
 */
export function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, content: raw }

  const yamlBlock = match[1]!
  const content = match[2]!.trim()
  const frontmatter: Record<string, unknown> = {}

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let value: unknown = line.slice(colonIdx + 1).trim()

    // Parse YAML arrays: [a, b, c]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
    }
    // Parse booleans
    else if (value === 'true') value = true
    else if (value === 'false') value = false

    frontmatter[key] = value
  }

  return { frontmatter, content }
}

// ─── Skill File Parsing ────────────────────────────────────────────────────

/** Parse a SKILL.md file into a SkillDef */
export function parseSkillFile(filePath: string): SkillDef | null {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const { frontmatter, content } = parseFrontmatter(raw)

    const name = (frontmatter.name as string) ?? dirname(filePath).split('/').pop() ?? 'unnamed'
    const description = (frontmatter.description as string) ?? ''

    return {
      name,
      description,
      content,
      allowedTools: frontmatter['allowed-tools'] as string[] | undefined,
      arguments: frontmatter.arguments as string[] | undefined,
      context: (frontmatter.context as 'inline' | 'fork') ?? 'inline',
      model: frontmatter.model as string | undefined,
      filePath: resolve(filePath),
    }
  } catch {
    return null
  }
}

// ─── Discovery ─────────────────────────────────────────────────────────────

/**
 * Discover skill directories.
 * Looks for SKILL.md files in immediate subdirectories of the given dirs.
 * Default: ['.claude/skills', '~/.claude/skills']
 */
export function discoverSkillFiles(dirs?: string[]): string[] {
  const searchDirs = dirs ?? [
    join(process.cwd(), '.claude', 'skills'),
  ]

  const files: string[] = []

  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue

    try {
      const entries = readdirSync(dir)
      for (const entry of entries) {
        const skillDir = join(dir, entry)
        if (!statSync(skillDir).isDirectory()) continue
        const skillFile = join(skillDir, 'SKILL.md')
        if (existsSync(skillFile)) {
          files.push(skillFile)
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }

  return files
}

/** Load all skills from directories */
export function loadSkills(dirs?: string[]): SkillDef[] {
  const files = discoverSkillFiles(dirs)
  return files.map(parseSkillFile).filter((s): s is SkillDef => s !== null)
}

// ─── Content Expansion ─────────────────────────────────────────────────────

/**
 * Expand skill content with argument substitution.
 * Replaces $ARG_NAME with provided values and ${CLAUDE_SKILL_DIR} with skill directory.
 */
export function expandSkillContent(skill: SkillDef, args?: string): string {
  let content = skill.content

  // Replace ${CLAUDE_SKILL_DIR}
  const skillDir = dirname(skill.filePath)
  content = content.replace(/\$\{CLAUDE_SKILL_DIR\}/g, skillDir)

  // Replace $ARG_NAME with positional args
  if (args && skill.arguments) {
    const argValues = args.split(/\s+/)
    for (let i = 0; i < skill.arguments.length; i++) {
      const argName = skill.arguments[i]!
      const argValue = argValues[i] ?? ''
      content = content.replace(new RegExp(`\\$${argName}`, 'g'), argValue)
    }
  }

  // Replace $ARGUMENTS with the full args string
  if (args) {
    content = content.replace(/\$ARGUMENTS/g, args)
  }

  return content
}

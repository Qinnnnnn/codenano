/**
 * E2E: Context Analysis — analyze conversation context for compression opportunities.
 *
 * Demonstrates:
 *   - classifyTool() — categorize tools (search/read/write/execute/other)
 *   - isCollapsible() — check if tool results can be safely collapsed
 *   - analyzeContext() — full context analysis with duplicate detection
 *
 * Run:
 *   ANTHROPIC_API_KEY=<key> ANTHROPIC_BASE_URL=<url> npx tsx examples/e2e-context-analysis.ts
 */

import { createAgent, defineTool, analyzeContext, classifyTool, isCollapsible } from '../src/index.js'
import { z } from 'zod'

const readFileTool = defineTool({
  name: 'Read',
  description: 'Read a file',
  input: z.object({ file_path: z.string() }),
  async execute({ file_path }) { return `Contents of ${file_path}: [mock content]` },
  isReadOnly: true,
})

const grepTool = defineTool({
  name: 'Grep',
  description: 'Search files',
  input: z.object({ pattern: z.string() }),
  async execute({ pattern }) { return `Found 3 matches for "${pattern}"` },
  isReadOnly: true,
})

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error(`  FAIL: ${msg}`); process.exit(1) }
  console.log(`  PASS: ${msg}`)
}

async function main() {
  console.log('\n=== E2E: Context Analysis ===\n')

  // ── 1. Tool Classification ─────────────────────────────────────
  console.log('--- 1. classifyTool() ---')
  const classifications = [
    ['Read', 'read'], ['Grep', 'search'], ['Bash', 'execute'],
    ['Write', 'write'], ['Edit', 'write'], ['WebSearch', 'search'],
    ['Agent', 'execute'], ['CustomTool', 'other'],
  ]
  for (const [tool, expected] of classifications) {
    const result = classifyTool(tool!)
    console.log(`  ${tool} → ${result}`)
    assert(result === expected, `${tool} classified as ${expected}`)
  }

  // ── 2. isCollapsible ───────────────────────────────────────────
  console.log('\n--- 2. isCollapsible() ---')
  assert(isCollapsible('Read') === true, 'Read is collapsible')
  assert(isCollapsible('Grep') === true, 'Grep is collapsible')
  assert(isCollapsible('WebSearch') === true, 'WebSearch is collapsible')
  assert(isCollapsible('Bash') === false, 'Bash is NOT collapsible')
  assert(isCollapsible('Write') === false, 'Write is NOT collapsible')
  assert(isCollapsible('Agent') === false, 'Agent is NOT collapsible')

  // ── 3. analyzeContext with real session ─────────────────────────
  console.log('\n--- 3. analyzeContext() with real session ---')
  const agent = createAgent({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    tools: [readFileTool, grepTool],
    systemPrompt: 'You are a code reviewer. Use Read and Grep tools. Be concise.',
    maxTurns: 5,
  })

  const session = agent.session()
  await session.send('Read the file /src/index.ts')
  await session.send('Search for "export" in the codebase using Grep')
  await session.send('Read /src/index.ts again to check something')

  const analysis = analyzeContext(session.history)
  console.log(`  Total messages: ${analysis.totalMessages}`)
  console.log(`  User messages: ${analysis.userMessages}`)
  console.log(`  Assistant messages: ${analysis.assistantMessages}`)
  console.log(`  Tool calls: ${analysis.toolCalls}`)
  console.log(`  Tool breakdown: ${JSON.stringify(analysis.toolCallsByName)}`)
  console.log(`  Duplicate file reads: ${JSON.stringify(analysis.duplicateFileReads)}`)
  console.log(`  Collapsible results: ${analysis.collapsibleResults}`)
  console.log(`  Estimated tokens: ${analysis.estimatedTokens}`)

  assert(analysis.totalMessages > 0, 'Has messages')
  assert(analysis.userMessages >= 3, 'Has at least 3 user messages')
  assert(analysis.toolCalls >= 0, 'Tool calls counted')
  assert(typeof analysis.estimatedTokens === 'number', 'Token estimate is a number')

  // ── 4. analyzeContext with synthetic data ───────────────────────
  console.log('\n--- 4. analyzeContext() with synthetic data ---')
  const syntheticMessages = [
    { role: 'user', content: 'Read two files' },
    {
      role: 'assistant',
      content: [
        { type: 'tool_use', name: 'Read', input: { file_path: '/a.ts' }, id: 't1' },
        { type: 'tool_use', name: 'Read', input: { file_path: '/b.ts' }, id: 't2' },
      ],
    },
    {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 't1', content: 'file a content' },
        { type: 'tool_result', tool_use_id: 't2', content: 'file b content' },
      ],
    },
    { role: 'user', content: 'Now read /a.ts again' },
    {
      role: 'assistant',
      content: [
        { type: 'tool_use', name: 'Read', input: { file_path: '/a.ts' }, id: 't3' },
        { type: 'tool_use', name: 'Bash', input: { command: 'ls' }, id: 't4' },
      ],
    },
  ]

  const synAnalysis = analyzeContext(syntheticMessages)
  console.log(`  Tool calls: ${synAnalysis.toolCalls}`)
  console.log(`  Read calls: ${synAnalysis.toolCallsByName['Read']}`)
  console.log(`  Bash calls: ${synAnalysis.toolCallsByName['Bash']}`)
  console.log(`  Duplicate reads: ${JSON.stringify(synAnalysis.duplicateFileReads)}`)
  console.log(`  Collapsible: ${synAnalysis.collapsibleResults}`)

  assert(synAnalysis.toolCalls === 4, '4 tool calls total')
  assert(synAnalysis.toolCallsByName['Read'] === 3, '3 Read calls')
  assert(synAnalysis.toolCallsByName['Bash'] === 1, '1 Bash call')
  assert(synAnalysis.duplicateFileReads['/a.ts'] === 2, '/a.ts read twice (duplicate)')
  assert(synAnalysis.collapsibleResults === 3, '3 collapsible results (Read x3)')

  console.log('\n=== All context analysis checks passed! ===\n')
}

main().catch(err => { console.error(err); process.exit(1) })

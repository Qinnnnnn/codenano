/**
 * E2E: MCP Protocol — connect to MCP servers and use their tools.
 *
 * Demonstrates:
 *   - connectMCPServer() — connect to an MCP server
 *   - listMCPTools() — discover available tools
 *   - mcpToolsToToolDefs() — convert MCP tools to codenano ToolDefs
 *   - buildMCPToolName() / parseMCPToolName() — tool name formatting
 *   - connectMCPServers() — batch connect with error handling
 *   - Using MCP tools with createAgent()
 *
 * Run (standalone — no API key needed for tool listing):
 *   npx tsx examples/e2e-mcp.ts
 *
 * Run with agent (needs API key + an MCP server):
 *   MCP_SERVER_COMMAND=<cmd> ANTHROPIC_API_KEY=<key> ANTHROPIC_BASE_URL=<url> npx tsx examples/e2e-mcp.ts
 */

import {
  connectMCPServer,
  connectMCPServers,
  listMCPTools,
  mcpToolsToToolDefs,
  buildMCPToolName,
  parseMCPToolName,
  disconnectAll,
  createAgent,
} from '../src/index.js'
import type { MCPServerConfig, MCPConnection } from '../src/index.js'

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error(`  FAIL: ${msg}`); process.exit(1) }
  console.log(`  PASS: ${msg}`)
}

async function main() {
  console.log('\n=== E2E: MCP Protocol Support ===\n')

  // ── 1. Tool Name Formatting ────────────────────────────────────
  console.log('--- 1. Tool name formatting ---')
  const name = buildMCPToolName('github', 'list_issues')
  console.log(`  Built: ${name}`)
  assert(name === 'mcp__github__list_issues', 'Correct format')

  const parsed = parseMCPToolName(name)
  console.log(`  Parsed: ${JSON.stringify(parsed)}`)
  assert(parsed?.serverName === 'github', 'Parsed server name')
  assert(parsed?.toolName === 'list_issues', 'Parsed tool name')

  assert(parseMCPToolName('Read') === null, 'Non-MCP name returns null')
  assert(parseMCPToolName('mcp__s__t')?.serverName === 's', 'Short names work')

  // ── 2. Config Validation ───────────────────────────────────────
  console.log('\n--- 2. Config validation ---')
  try {
    await connectMCPServer({ name: 'bad', transport: 'stdio' })
    assert(false, 'Should have thrown')
  } catch (e: any) {
    console.log(`  stdio without command: ${e.message}`)
    assert(e.message.includes('requires "command"'), 'Validates stdio config')
  }

  try {
    await connectMCPServer({ name: 'bad', transport: 'sse' })
    assert(false, 'Should have thrown')
  } catch (e: any) {
    console.log(`  sse without url: ${e.message}`)
    assert(e.message.includes('requires "url"'), 'Validates sse config')
  }

  // ── 3. Batch connect with error handling ───────────────────────
  console.log('\n--- 3. Batch connect (graceful failure) ---')
  const result = await connectMCPServers([
    { name: 'nonexistent', transport: 'stdio', command: 'this-does-not-exist' },
  ])
  console.log(`  Tools: ${result.tools.length}`)
  console.log(`  Connections: ${result.connections.length}`)
  assert(result.tools.length === 0, 'No tools from failed connection')
  assert(result.connections.length === 0, 'No connections from failed server')

  // ── 4. Live MCP server (if available) ──────────────────────────
  const mcpCommand = process.env.MCP_SERVER_COMMAND
  if (mcpCommand) {
    console.log(`\n--- 4. Live MCP server: ${mcpCommand} ---`)
    const [cmd, ...args] = mcpCommand.split(' ')
    let conn: MCPConnection | null = null

    try {
      conn = await connectMCPServer({
        name: 'live-server',
        transport: 'stdio',
        command: cmd!,
        args,
      })
      console.log(`  Connected to: ${conn.name}`)

      const tools = await listMCPTools(conn)
      console.log(`  Available tools: ${tools.length}`)
      for (const t of tools.slice(0, 5)) {
        console.log(`    - ${t.name}: ${t.description?.slice(0, 60)}`)
      }
      assert(tools.length > 0, 'Server has tools')

      const toolDefs = await mcpToolsToToolDefs(conn)
      console.log(`  Converted to ${toolDefs.length} ToolDefs`)
      assert(toolDefs[0]!.name.startsWith('mcp__live-server__'), 'Tool names prefixed')

      // Use with agent if API key available
      if (process.env.ANTHROPIC_API_KEY) {
        console.log('\n  Using MCP tools with agent...')
        const agent = createAgent({
          model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
          apiKey: process.env.ANTHROPIC_API_KEY,
          baseURL: process.env.ANTHROPIC_BASE_URL,
          tools: toolDefs,
          systemPrompt: 'You have access to MCP tools. Use them to answer questions. Be concise.',
          maxTurns: 3,
        })

        const r = await agent.ask(`List the available tools you have and describe what each does.`)
        console.log(`  Agent response: ${r.text.slice(0, 150)}...`)
        console.log(`  Cost: $${r.costUSD.toFixed(6)}`)
      }
    } finally {
      if (conn) await conn.close()
    }
  } else {
    console.log('\n--- 4. Live MCP server: SKIPPED (set MCP_SERVER_COMMAND to test) ---')
  }

  console.log('\n=== All MCP checks passed! ===\n')
}

main().catch(err => { console.error(err); process.exit(1) })

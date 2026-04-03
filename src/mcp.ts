/**
 * mcp.ts — MCP (Model Context Protocol) client integration
 *
 * Connects to MCP servers and wraps their tools as codenano ToolDefs.
 * Inspired by Claude Code's src/services/mcp/client.ts — simplified for SDK use.
 *
 * Supports stdio, SSE, and streamable HTTP transports.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { z } from 'zod'
import { defineTool } from './tool-builder.js'
import type { ToolDef } from './types.js'

// ─── Types ─────────────────────────────────────────────────────────────────

/** Configuration for connecting to an MCP server */
export interface MCPServerConfig {
  /** Server name — used as tool name prefix (mcp__<name>__<tool>) */
  name: string
  /** Transport type */
  transport: 'stdio' | 'sse' | 'http'
  /** For stdio: command to spawn */
  command?: string
  /** For stdio: command arguments */
  args?: string[]
  /** For stdio: environment variables */
  env?: Record<string, string>
  /** For sse/http: server URL */
  url?: string
  /** For sse/http: custom headers */
  headers?: Record<string, string>
}

/** Active MCP server connection */
export interface MCPConnection {
  name: string
  client: Client
  close: () => Promise<void>
}

// ─── Tool Name Formatting ──────────────────────────────────────────────────

/** Build prefixed tool name: mcp__<serverName>__<toolName> */
export function buildMCPToolName(serverName: string, toolName: string): string {
  return `mcp__${serverName}__${toolName}`
}

/** Parse an MCP tool name back to server + tool */
export function parseMCPToolName(prefixed: string): { serverName: string; toolName: string } | null {
  const match = prefixed.match(/^mcp__(.+?)__(.+)$/)
  if (!match) return null
  return { serverName: match[1]!, toolName: match[2]! }
}

// ─── Connect ───────────────────────────────────────────────────────────────

/** Connect to a single MCP server */
export async function connectMCPServer(config: MCPServerConfig): Promise<MCPConnection> {
  let transport

  switch (config.transport) {
    case 'stdio': {
      if (!config.command) throw new Error(`MCP server "${config.name}": stdio transport requires "command"`)
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
      })
      break
    }
    case 'sse': {
      if (!config.url) throw new Error(`MCP server "${config.name}": sse transport requires "url"`)
      transport = new SSEClientTransport(new URL(config.url), {
        requestInit: config.headers ? { headers: config.headers } : undefined,
      } as any)
      break
    }
    case 'http': {
      if (!config.url) throw new Error(`MCP server "${config.name}": http transport requires "url"`)
      transport = new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: config.headers ? { headers: config.headers } : undefined,
      } as any)
      break
    }
    default:
      throw new Error(`MCP server "${config.name}": unsupported transport "${config.transport}"`)
  }

  const client = new Client(
    { name: 'codenano', version: '0.3.0' },
    { capabilities: {} },
  )

  await client.connect(transport)

  return {
    name: config.name,
    client,
    close: async () => { await client.close() },
  }
}

// ─── List & Call Tools ─────────────────────────────────────────────────────

/** List tools from a connected MCP server */
export async function listMCPTools(conn: MCPConnection) {
  const result = await conn.client.listTools()
  return result.tools
}

/** Call an MCP tool and return text result */
export async function callMCPTool(
  conn: MCPConnection,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ content: string; isError: boolean }> {
  const result = await conn.client.callTool({ name: toolName, arguments: args })
  const text = (result.content as any[])
    ?.filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n') ?? ''
  return { content: text, isError: (result.isError as boolean) ?? false }
}

// ─── Convert to ToolDefs ───────────────────────────────────────────────────

/** Convert all tools from an MCP server to codenano ToolDefs */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function mcpToolsToToolDefs(conn: MCPConnection): Promise<ToolDef<any>[]> {
  const tools = await listMCPTools(conn)

  return tools.map(tool => {
    const prefixedName = buildMCPToolName(conn.name, tool.name)

    return defineTool({
      name: prefixedName,
      description: tool.description ?? `MCP tool: ${tool.name}`,
      input: z.record(z.string(), z.unknown()),

      async execute(input) {
        try {
          const result = await callMCPTool(conn, tool.name, input as Record<string, unknown>)
          return result.isError
            ? { content: result.content || 'MCP tool returned error', isError: true }
            : result.content || '(empty result)'
        } catch (err: any) {
          return { content: `MCP error: ${err.message}`, isError: true }
        }
      },

      isReadOnly: true,
      isConcurrencySafe: true,
    })
  })
}

// ─── Batch Connect ─────────────────────────────────────────────────────────

/** Connect to multiple MCP servers and return all tools as ToolDefs */
export async function connectMCPServers(
  configs: MCPServerConfig[],
): Promise<{ tools: ToolDef[]; connections: MCPConnection[] }> {
  const connections: MCPConnection[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTools: ToolDef<any>[] = []

  for (const config of configs) {
    try {
      const conn = await connectMCPServer(config)
      connections.push(conn)
      const tools = await mcpToolsToToolDefs(conn)
      allTools.push(...tools)
    } catch (err: any) {
      console.warn(`MCP: failed to connect to "${config.name}": ${err.message}`)
    }
  }

  return { tools: allTools, connections }
}

/** Disconnect all MCP servers */
export async function disconnectAll(connections: MCPConnection[]): Promise<void> {
  for (const conn of connections) {
    try { await conn.close() } catch { /* best-effort */ }
  }
}

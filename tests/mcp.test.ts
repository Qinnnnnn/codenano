/**
 * Unit tests for MCP protocol support
 */

import { describe, it, expect, vi } from 'vitest'
import { buildMCPToolName, parseMCPToolName } from '../src/mcp.js'

describe('buildMCPToolName', () => {
  it('formats tool name with server prefix', () => {
    expect(buildMCPToolName('github', 'list_issues')).toBe('mcp__github__list_issues')
  })

  it('handles server names with hyphens', () => {
    expect(buildMCPToolName('my-server', 'do_thing')).toBe('mcp__my-server__do_thing')
  })
})

describe('parseMCPToolName', () => {
  it('parses prefixed tool name', () => {
    const result = parseMCPToolName('mcp__github__list_issues')
    expect(result).toEqual({ serverName: 'github', toolName: 'list_issues' })
  })

  it('handles tool names with underscores', () => {
    const result = parseMCPToolName('mcp__slack__search_messages')
    expect(result).toEqual({ serverName: 'slack', toolName: 'search_messages' })
  })

  it('returns null for non-MCP tool names', () => {
    expect(parseMCPToolName('Read')).toBeNull()
    expect(parseMCPToolName('Bash')).toBeNull()
    expect(parseMCPToolName('mcp_missing_prefix')).toBeNull()
  })

  it('round-trips with buildMCPToolName', () => {
    const name = buildMCPToolName('server', 'tool')
    const parsed = parseMCPToolName(name)
    expect(parsed).toEqual({ serverName: 'server', toolName: 'tool' })
  })
})

describe('MCPServerConfig validation', () => {
  it('stdio config requires command', async () => {
    const { connectMCPServer } = await import('../src/mcp.js')
    await expect(
      connectMCPServer({ name: 'test', transport: 'stdio' }),
    ).rejects.toThrow('requires "command"')
  })

  it('sse config requires url', async () => {
    const { connectMCPServer } = await import('../src/mcp.js')
    await expect(
      connectMCPServer({ name: 'test', transport: 'sse' }),
    ).rejects.toThrow('requires "url"')
  })

  it('http config requires url', async () => {
    const { connectMCPServer } = await import('../src/mcp.js')
    await expect(
      connectMCPServer({ name: 'test', transport: 'http' }),
    ).rejects.toThrow('requires "url"')
  })

  it('rejects unsupported transport', async () => {
    const { connectMCPServer } = await import('../src/mcp.js')
    await expect(
      connectMCPServer({ name: 'test', transport: 'grpc' as any }),
    ).rejects.toThrow('unsupported transport')
  })
})

describe('connectMCPServers', () => {
  it('returns empty arrays when no configs', async () => {
    const { connectMCPServers } = await import('../src/mcp.js')
    const result = await connectMCPServers([])
    expect(result.tools).toEqual([])
    expect(result.connections).toEqual([])
  })

  it('handles connection failures gracefully', async () => {
    const { connectMCPServers } = await import('../src/mcp.js')
    // This will fail because the command doesn't exist, but should not throw
    const result = await connectMCPServers([
      { name: 'bad', transport: 'stdio', command: 'nonexistent-command-xyz' },
    ])
    expect(result.tools).toEqual([])
    expect(result.connections).toEqual([])
  })
})

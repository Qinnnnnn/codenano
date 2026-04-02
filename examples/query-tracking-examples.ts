/**
 * Query Tracking Usage Examples
 *
 * Demonstrates how to use Query Tracking feature
 */

import { createAgent, defineTool } from 'codenano'
import { z } from 'zod'

// ============================================================================
// Example 1: Basic Usage - Listen to query_start event
// ============================================================================

async function example1_basicUsage() {
  const agent = createAgent({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
    systemPrompt: 'You are a helpful assistant.',
  })

  console.log('=== Example 1: Basic Usage ===')

  for await (const event of agent.stream('Say hello')) {
    if (event.type === 'query_start') {
      console.log('Query started:')
      console.log('  Chain ID:', event.queryTracking.chainId)
      console.log('  Depth:', event.queryTracking.depth)
    }

    if (event.type === 'result') {
      console.log('Query completed:')
      console.log('  Chain ID:', event.result.queryTracking.chainId)
      console.log('  Depth:', event.result.queryTracking.depth)
    }
  }
}

// ============================================================================
// Example 2: Get queryTracking from Result
// ============================================================================

async function example2_fromResult() {
  const agent = createAgent({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
  })

  console.log('\n=== Example 2: From Result ===')

  const result = await agent.ask('What is 2+2?')

  console.log('Result:', result.text)
  console.log('Query Tracking:', result.queryTracking)
  // { chainId: '...', depth: 0 }
}

// ============================================================================
// Example 3: queryTracking in Session
// ============================================================================

async function example3_session() {
  const agent = createAgent({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
  })

  const session = agent.session()

  console.log('\n=== Example 3: Session ===')

  // First turn
  const result1 = await session.send('My name is Alice')
  console.log('Turn 1:')
  console.log('  Chain ID:', result1.queryTracking.chainId)
  console.log('  Depth:', result1.queryTracking.depth) // 0

  // Second turn - inherits chainId, depth + 1
  const result2 = await session.send('What is my name?')
  console.log('Turn 2:')
  console.log('  Chain ID:', result2.queryTracking.chainId) // same
  console.log('  Depth:', result2.queryTracking.depth) // 1

  // Verify same chainId
  console.log('Same chain?', result1.queryTracking.chainId === result2.queryTracking.chainId)
}

// ============================================================================
// Example 4: Integration with Logging System
// ============================================================================

async function example4_withLogging() {
  const agent = createAgent({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
  })

  console.log('\n=== Example 4: With Logging ===')

  // Simple logging function
  function log(level: string, message: string, tracking: any) {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [${level}] [${tracking.chainId.slice(0, 8)}:${tracking.depth}] ${message}`)
  }

  for await (const event of agent.stream('Calculate 10 + 20')) {
    if (event.type === 'query_start') {
      log('INFO', 'Query started', event.queryTracking)
    }

    if (event.type === 'text') {
      log('DEBUG', `Text: ${event.text.slice(0, 50)}...`, { chainId: 'current', depth: 0 })
    }

    if (event.type === 'result') {
      log('INFO', `Query completed in ${event.result.durationMs}ms`, event.result.queryTracking)
    }
  }
}

// ============================================================================
// Example 5: Tool Call Tracking
// ============================================================================

async function example5_toolTracking() {
  const calculatorTool = defineTool({
    name: 'Calculator',
    description: 'Perform calculations',
    input: z.object({
      expression: z.string(),
    }),
    execute: async ({ expression }) => {
      return `Result: ${eval(expression)}`
    },
  })

  const agent = createAgent({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
    tools: [calculatorTool],
    systemPrompt: 'Use Calculator tool for math.',
  })

  console.log('\n=== Example 5: Tool Tracking ===')

  let currentTracking: any = null

  for await (const event of agent.stream('What is 15 * 23?')) {
    if (event.type === 'query_start') {
      currentTracking = event.queryTracking
      console.log(`[${currentTracking.chainId.slice(0, 8)}:${currentTracking.depth}] Query started`)
    }

    if (event.type === 'tool_use') {
      console.log(`[${currentTracking.chainId.slice(0, 8)}:${currentTracking.depth}] Tool: ${event.toolName}`)
    }

    if (event.type === 'tool_result') {
      console.log(`[${currentTracking.chainId.slice(0, 8)}:${currentTracking.depth}] Tool result: ${event.output}`)
    }
  }
}

// ============================================================================
// Example 6: Multiple Agent Instances
// ============================================================================

async function example6_multipleAgents() {
  console.log('\n=== Example 6: Multiple Agents ===')

  const agent1 = createAgent({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
  })

  const agent2 = createAgent({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
  })

  const result1 = await agent1.ask('Hello')
  const result2 = await agent2.ask('Hello')

  console.log('Agent 1 Chain ID:', result1.queryTracking.chainId)
  console.log('Agent 2 Chain ID:', result2.queryTracking.chainId)
  console.log('Different chains?', result1.queryTracking.chainId !== result2.queryTracking.chainId)
}

// ============================================================================
// Example 7: Error Tracking
// ============================================================================

async function example7_errorTracking() {
  const agent = createAgent({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
  })

  console.log('\n=== Example 7: Error Tracking ===')

  let tracking: any = null

  try {
    for await (const event of agent.stream('Test query')) {
      if (event.type === 'query_start') {
        tracking = event.queryTracking
      }

      if (event.type === 'error') {
        console.error(`[${tracking.chainId}:${tracking.depth}] Error:`, event.error.message)
      }
    }
  } catch (error) {
    if (tracking) {
      console.error(`[${tracking.chainId}:${tracking.depth}] Exception:`, error)
    }
  }
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  await example1_basicUsage()
  await example2_fromResult()
  await example3_session()
  await example4_withLogging()
  await example5_toolTracking()
  await example6_multipleAgents()
  await example7_errorTracking()
}

// Uncomment to run
// runAllExamples().catch(console.error)

export {
  example1_basicUsage,
  example2_fromResult,
  example3_session,
  example4_withLogging,
  example5_toolTracking,
  example6_multipleAgents,
  example7_errorTracking,
}

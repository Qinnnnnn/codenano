import { createAgent, defineTool } from '../src/index.js'
import { z } from 'zod'

// 定义一个简单的计算器工具
const calculator = defineTool({
  name: 'Calculator',
  description: 'Perform basic math operations',
  input: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    console.log(`[TOOL] Calculator called: ${a} ${operation} ${b}`)
    let result: number
    switch (operation) {
      case 'add': result = a + b; break
      case 'subtract': result = a - b; break
      case 'multiply': result = a * b; break
      case 'divide': result = a / b; break
    }
    return `Result: ${result}`
  },
  isReadOnly: true,
})

async function main() {
  console.log('=== Agent Demo ===\n')

  const agent = createAgent({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    model: 'claude-sonnet-4-6',
    tools: [calculator],
    systemPrompt: 'You are a helpful math assistant. Use the Calculator tool to solve math problems.',
    maxTurns: 5,
  })

  console.log('[Agent] Starting conversation...\n')

  // 流式输出
  for await (const event of agent.stream('What is 15 multiplied by 8?')) {
    if (event.type === 'turn_start') {
      console.log(`[Turn ${event.turnNumber}] Started`)
    }
    if (event.type === 'text') {
      process.stdout.write(event.text)
    }
    if (event.type === 'tool_use') {
      console.log(`\n[Tool] Using: ${event.toolName}`)
      console.log(`[Tool] Input:`, JSON.stringify(event.input, null, 2))
    }
    if (event.type === 'tool_result') {
      console.log(`[Tool] Result: ${event.output}`)
    }
    if (event.type === 'turn_end') {
      console.log(`\n[Turn ${event.turnNumber}] Ended (${event.stopReason})`)
    }
    if (event.type === 'result') {
      console.log('\n\n=== Final Result ===')
      console.log('Response:', event.result.text)
      console.log('Turns:', event.result.numTurns)
      console.log('Tokens:', event.result.usage.inputTokens, 'in /', event.result.usage.outputTokens, 'out')
      console.log('Duration:', event.result.durationMs, 'ms')
    }
  }
}

main().catch(console.error)

/**
 * Run examples from query-tracking-examples.ts
 */

import {
  example1_basicUsage,
  example2_fromResult,
  example3_session,
} from './query-tracking-examples.js'

async function runExamples() {
  console.log('Running Query Tracking Examples...\n')

  try {
    await example1_basicUsage()
    console.log('\n' + '='.repeat(60) + '\n')

    await example2_fromResult()
    console.log('\n' + '='.repeat(60) + '\n')

    await example3_session()
    console.log('\n' + '='.repeat(60) + '\n')

    console.log('✅ All examples completed successfully!')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

runExamples()

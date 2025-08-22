#!/usr/bin/env node

/**
 * Authentication Test Runner
 * 
 * This script runs comprehensive tests for the Authentication Service
 * as specified in AUTHENTICATION_SPEC.md
 * 
 * Usage:
 *   npm run test:auth          - Run all authentication tests
 *   npm run test:auth -- --verbose  - Run with verbose output
 *   npm run test:coverage     - Run with coverage report
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔐 Authentication Service Test Suite');
console.log('=====================================\n');

try {
  console.log('📋 Test Categories:');
  console.log('  • Token Refresh Endpoint Tests');
  console.log('  • Token Revoke Endpoint Tests');
  console.log('  • Session Validation Endpoint Tests');
  console.log('  • Integration & Security Tests');
  console.log('  • Edge Cases & Error Handling\n');

  console.log('🚀 Starting test execution...\n');
  
  // Get command line arguments
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const coverage = args.includes('--coverage');
  
  let testCommand = 'npx jest src/tests/auth.complete.test.js';
  
  if (verbose) {
    testCommand += ' --verbose';
  }
  
  if (coverage) {
    testCommand += ' --coverage';
  }
  
  // Run the tests
  execSync(testCommand, { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('\n✅ Authentication tests completed successfully!');
  console.log('\n📊 Test Summary:');
  console.log('  • All endpoint specifications validated');
  console.log('  • Security requirements verified');
  console.log('  • Error handling tested');
  console.log('  • Business logic confirmed\n');
  
} catch (error) {
  console.error('❌ Test execution failed:');
  console.error(error.message);
  process.exit(1);
}

console.log('📖 For detailed test specification, see:');
console.log('   src/tests/AUTH_TEST_SPECIFICATION.md\n');
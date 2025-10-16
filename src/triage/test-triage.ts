#!/usr/bin/env node

/**
 * Test script for the runTriage function using real Splunk test data
 * 
 * This script:
 * 1. Loads test data from splunk-test-data.json
 * 2. Transforms it to the expected SplunkLogEvent format
 * 3. Tests the runTriage function with various configurations
 * 4. Provides detailed output for debugging and validation
 */

import 'dotenv/config';  // Load environment variables from .env file
import { runTriage, TriageConfig } from './triageWorkflow.js';
import { SplunkLogEvent } from './types.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SplunkTestData {
  "@l": string;
  Application: string;
  Environment: string;
  _time: string;
  _raw: string;
  source?: string;
  [key: string]: any;
}

/**
 * Extract meaningful error message from Splunk _raw field
 */
function extractErrorMessage(rawData: string): string {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(rawData);
    
    // Look for error message in various fields
    if (parsed['@mt']) {
      return parsed['@mt']; // Message template
    }
    if (parsed['@x']) {
      return parsed['@x']; // Exception details
    }
    if (parsed.message) {
      return parsed.message;
    }
    
    // Fallback to raw data (truncated)
    return rawData.substring(0, 500) + (rawData.length > 500 ? '...' : '');
  } catch {
    // If not JSON, return raw data (truncated)
    return rawData.substring(0, 500) + (rawData.length > 500 ? '...' : '');
  }
}

/**
 * Transform Splunk test data to SplunkLogEvent format
 */
function transformTestData(testData: SplunkTestData[]): SplunkLogEvent[] {
  return testData.map((item, index) => {
    const errorMessage = extractErrorMessage(item._raw);
    
    return {
      _time: item._time,
      message: errorMessage,
      source: item.source || `test-source-${index}`,
      serviceName: item.Application || 'unknown-service',
      environment: item.Environment || 'unknown-environment',
      level: item['@l'] || 'ERROR'
    };
  });
}

/**
 * Load and parse test data
 */
function loadTestData(): SplunkLogEvent[] {
  try {
    console.log('📁 Loading test data from splunk-test-data.json...');
    const testDataPath = join(__dirname, '../../instructions/splunk-test-data.json');
    const rawData = readFileSync(testDataPath, 'utf-8');
    const testData: SplunkTestData[] = JSON.parse(rawData);
    
    console.log(`✅ Loaded ${testData.length} test records`);
    
    // Transform to expected format
    const transformedData = transformTestData(testData);
    console.log(`✅ Transformed ${transformedData.length} records to SplunkLogEvent format`);
    
    return transformedData;
  } catch (error) {
    console.error('❌ Failed to load test data:', error);
    throw error;
  }
}

/**
 * Print sample data for debugging
 */
function printSampleData(data: SplunkLogEvent[], count: number = 3) {
  console.log(`\n🔍 Sample data (first ${count} records):`);
  console.log('=' .repeat(80));
  
  data.slice(0, count).forEach((log, index) => {
    console.log(`\nRecord ${index + 1}:`);
    console.log(`  Time: ${log._time}`);
    console.log(`  Service: ${log.serviceName}`);
    console.log(`  Environment: ${log.environment}`);
    console.log(`  Level: ${log.level}`);
    console.log(`  Message: ${log.message.substring(0, 150)}${log.message.length > 150 ? '...' : ''}`);
  });
  
  console.log('=' .repeat(80));
}

/**
 * Run test scenarios
 */
async function runTestScenarios() {
  try {
    console.log('\n🧪 Starting Triage Function Test Suite');
    console.log('=' .repeat(50));
    
    // Load test data
    const testData = loadTestData();
    
    // Print sample data
    printSampleData(testData);
    
    // Test Scenario 1: Dry run with small dataset
    console.log('\n🔬 Test Scenario 1: Dry Run (Small Dataset)');
    console.log('-' .repeat(40));
    
    const smallDataset = testData.slice(0, 10);
    const dryRunConfig: TriageConfig = {
      repositoryName: 'wexhealth/cdh-consumer', // Example repo name
      commitLookbackDays: 7,
      createTickets: false // Dry run
    };
    
    console.log('Configuration:', dryRunConfig);
    await runTriage(smallDataset, dryRunConfig);
    
    // Test Scenario 2: Different repository
    console.log('\n🔬 Test Scenario 2: Different Repository');
    console.log('-' .repeat(40));
    
    const differentRepoConfig: TriageConfig = {
      repositoryName: 'wexhealth/document-index', // Different repo
      commitLookbackDays: 3,
      createTickets: false
    };
    
    console.log('Configuration:', differentRepoConfig);
    await runTriage(smallDataset, differentRepoConfig);
    
    // Test Scenario 3: Larger dataset
    console.log('\n🔬 Test Scenario 3: Larger Dataset');
    console.log('-' .repeat(40));
    
    const largerDataset = testData.slice(0, 50);
    const largerDatasetConfig: TriageConfig = {
      repositoryName: 'wexhealth/cdh-platform',
      commitLookbackDays: 5,
      createTickets: false
    };
    
    console.log('Configuration:', largerDatasetConfig);
    await runTriage(largerDataset, largerDatasetConfig);
    
    // Test Scenario 4: No repository (should handle gracefully)
    console.log('\n🔬 Test Scenario 4: No Repository Configuration');
    console.log('-' .repeat(40));
    
    const noRepoConfig: TriageConfig = {
      commitLookbackDays: 7,
      createTickets: false
    };
    
    console.log('Configuration:', noRepoConfig);
    await runTriage(smallDataset, noRepoConfig);
    
    // Test Scenario 5: Error handling - invalid config
    console.log('\n🔬 Test Scenario 5: Invalid Configuration (Error Handling)');
    console.log('-' .repeat(40));
    
    try {
      const invalidConfig: TriageConfig = {
        repositoryName: 'invalid-repo-name', // Invalid format
        commitLookbackDays: 35, // Too many days
        createTickets: false
      };
      
      console.log('Configuration:', invalidConfig);
      await runTriage(smallDataset, invalidConfig);
    } catch (error) {
      console.log('✅ Successfully caught invalid configuration error:', (error as Error).message);
    }
    
    console.log('\n🎉 All test scenarios completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
🧪 Triage Function Test Suite
============================

This test script validates the runTriage function using real Splunk data.

Environment Variables (Optional):
  GITHUB_TOKEN - GitHub token for commit analysis
  JIRA_PAT     - Jira token for ticket creation
  SPLUNK_URL   - Splunk URL for state management

Test Scenarios:
  1. Dry run with small dataset
  2. Different repository configuration
  3. Larger dataset processing
  4. No repository configuration
  5. Invalid configuration (error handling)

Usage:
  npm run build && node build/triage/test-triage.js
  
Or directly:
  npx tsx src/triage/test-triage.ts
`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }
  
  console.log('🚀 Triage Function Test Suite Starting...');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  
  // Check environment
  console.log('\n🌍 Environment Check:');
  console.log(`  GitHub Token: ${process.env.GITHUB_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  Jira Token: ${process.env.JIRA_PAT ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  Splunk URL: ${process.env.SPLUNK_URL ? '✅ Configured' : '❌ Not configured'}`);
  
  await runTestScenarios();
  
  console.log(`\n📅 Completed at: ${new Date().toISOString()}`);
  console.log('🏁 Test suite finished!');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unhandled error in test suite:', error);
    process.exit(1);
  });
}

export { loadTestData, transformTestData, runTestScenarios };

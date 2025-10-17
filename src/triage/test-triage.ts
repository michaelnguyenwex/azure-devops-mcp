#!/usr/bin/env node

/**
 * Test script for the triageSplunkErrorTool function using real Splunk test data
 * 
 * This script:
 * 1. Loads test data from splunk-test-data.json
 * 2. Tests the core logic of triageSplunkErrorTool
 * 3. Validates parsing, commit analysis, and result formatting
 * 4. Provides detailed output for debugging and validation
 */

import 'dotenv/config';  // Load environment variables from .env file
import { parseRawSplunkEvent, parseRawSplunkEventWithOpenAI } from './splunkParser.js';
import { findSuspectedCommits } from './commitAnalyzer.js';
import { GitHubService } from './githubService.js';
import { TriageInput, Commit } from './types.js';
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
 * Simulates the core logic of triageSplunkErrorTool without MCP server
 */
async function testTriageSplunkErrorTool(
  rawSplunkData: string,
  repositoryName: string,
  commitLookbackDays: number = 7
): Promise<{
  triageInput: TriageInput;
  suspectedCommits: Commit[];
  success: boolean;
  error?: string;
}> {
  try {
    console.log(`\n🔍 Starting automated error triage with Splunk data parsing`);
    
    // Step 1: Parse the raw Splunk JSON data and extract structured triage input using OpenAI
    console.log('📋 Step 1: Parsing raw Splunk data and extracting error information with OpenAI...');
    const triageInput: TriageInput = await parseRawSplunkEventWithOpenAI(rawSplunkData);
    
    console.log('✅ Parsed error details:', {
      serviceName: triageInput.serviceName,
      environment: triageInput.environment,
      exceptionType: triageInput.exceptionType,
      errorMessage: triageInput.errorMessage.substring(0, 100) + (triageInput.errorMessage.length > 100 ? '...' : ''),
      stackFrames: triageInput.stackTrace.length,
      searchKeywords: {
        files: triageInput.searchKeywords.files.length,
        methods: triageInput.searchKeywords.methods.length,
        context: triageInput.searchKeywords.context.length
      }
    });
    
    // Step 2: Analyze GitHub commits for potential root causes
    console.log('🔍 Step 2: Analyzing GitHub commits...');
    const commitLookbackDaysVal = commitLookbackDays || 7;
    const githubService = new GitHubService();
    
    let suspectedCommits: Commit[] = [];
    if (repositoryName) {
      try {
        const lookbackDate = new Date(Date.now() - (commitLookbackDaysVal * 24 * 60 * 60 * 1000)).toISOString();
        const recentCommits = await githubService.getCommitsSince(repositoryName, lookbackDate);
        
        console.log(`📊 Found ${recentCommits.length} recent commits to analyze`);
        
        // Use the structured error information for commit analysis
        const searchTerms = [
          triageInput.errorMessage,
          triageInput.exceptionType,
          ...triageInput.searchKeywords.files.map(f => f.replace('.cs', '')),
          ...triageInput.searchKeywords.methods,
          ...triageInput.searchKeywords.context
        ].join(' ');
        
        suspectedCommits = findSuspectedCommits(searchTerms, recentCommits);
        console.log(`🎯 Identified ${suspectedCommits.length} suspected commits`);
        
      } catch (githubError) {
        console.warn('⚠️  GitHub analysis failed:', githubError instanceof Error ? githubError.message : 'Unknown error');
      }
    } else {
      console.log('⚠️  No repository specified - skipping GitHub analysis');
    }
    
    return {
      triageInput,
      suspectedCommits,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Triage analysis failed:', error);
    return {
      triageInput: {} as TriageInput,
      suspectedCommits: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Load and parse raw Splunk test data for triageSplunkErrorTool testing
 */
function loadRawTestData(): SplunkTestData[] {
  try {
    console.log('📁 Loading test data from splunk-test-data.json...');
    const testDataPath = join(__dirname, '../../instructions/splunk-test-data.json');
    const rawData = readFileSync(testDataPath, 'utf-8');
    const testData: SplunkTestData[] = JSON.parse(rawData);
    
    console.log(`✅ Loaded ${testData.length} raw Splunk test records`);
    
    return testData;
  } catch (error) {
    console.error('❌ Failed to load test data:', error);
    throw error;
  }
}

/**
 * Print sample raw Splunk data for debugging
 */
function printSampleRawData(data: SplunkTestData[], count: number = 1) {
  console.log(`\n🔍 Sample raw Splunk data (first ${count} records):`);
  console.log('=' .repeat(80));
  
  data.slice(0, count).forEach((event, index) => {
    console.log(`\nRaw Splunk Event ${index + 1}:`);
    console.log(`  Time: ${event._time}`);
    console.log(`  Application: ${event.Application}`);
    console.log(`  Environment: ${event.Environment}`);
    console.log(`  Log Level: ${event['@l']}`);
    console.log(`  Raw Data Preview: ${event._raw.substring(0, 200)}${event._raw.length > 200 ? '...' : ''}`);
  });
  
  console.log('=' .repeat(80));
}

/**
 * Display detailed analysis results
 */
function displayAnalysisResults(
  triageInput: TriageInput, 
  suspectedCommits: Commit[], 
  testName: string
) {
  console.log(`\n📋 ${testName} - Analysis Results:`);
  console.log('=' .repeat(50));
  console.log(`Service: ${triageInput.serviceName}`);
  console.log(`Environment: ${triageInput.environment}`);
  console.log(`Exception: ${triageInput.exceptionType}`);
  console.log(`Error: ${triageInput.errorMessage}`);
  console.log(`Stack Frames: ${triageInput.stackTrace.length}`);
  
  if (triageInput.stackTrace.length > 0) {
    console.log('\n🔍 Key Stack Frames:');
    triageInput.stackTrace.slice(0, 5).forEach((frame, index) => {
      console.log(`  ${index + 1}. ${frame.method} in ${frame.file}${frame.line ? `:${frame.line}` : ''}`);
    });
  }
  
  console.log('\n🔍 Search Keywords:');
  console.log(`  Files: ${triageInput.searchKeywords.files.join(', ')}`);
  console.log(`  Methods: ${triageInput.searchKeywords.methods.join(', ')}`);
  console.log(`  Context: ${triageInput.searchKeywords.context.join(', ')}`);
  
  if (suspectedCommits.length > 0) {
    console.log('\n🎯 Suspected Commits:');
    suspectedCommits.slice(0, 5).forEach((commit, index) => {
      console.log(`  ${index + 1}. ${commit.hash.substring(0, 8)} - ${commit.message.substring(0, 80)}...`);
      console.log(`     Author: ${commit.author} | Date: ${commit.date}`);
    });
  } else {
    console.log('\n🎯 No suspected commits found or GitHub analysis skipped');
  }
}

/**
 * Run test scenarios for triageSplunkErrorTool
 */
async function runTestScenarios() {
  try {
    console.log('\n🧪 Starting TriageSplunkErrorTool Test Suite');
    console.log('=' .repeat(50));
    
    // Load raw Splunk test data
    const rawTestData = loadRawTestData();
    
    // Print sample raw data
    printSampleRawData(rawTestData);
    
    // Get first test event for all scenarios
    const firstEvent = rawTestData[0];
    const rawEventJson = JSON.stringify(firstEvent);
    
    // Test Scenario 1: Basic parsing and GitHub analysis
    console.log('\n🔬 Test Scenario 1: Complete Analysis with GitHub Repository');
    console.log('-' .repeat(50));
    
    const result1 = await testTriageSplunkErrorTool(
      rawEventJson,
      'wexhealth/cdh-consumer', // Example repo name
      7 // lookback days
    );
    
    if (result1.success) {
      displayAnalysisResults(result1.triageInput, result1.suspectedCommits, 'Scenario 1');
      console.log('✅ Test Scenario 1: SUCCESS');
    } else {
      console.log(`❌ Test Scenario 1: FAILED - ${result1.error}`);
    }
    
    // Test Scenario 2: Different repository
    console.log('\n🔬 Test Scenario 2: Different Repository');
    console.log('-' .repeat(50));
    
    const result2 = await testTriageSplunkErrorTool(
      rawEventJson,
      'wexhealth/document-index', // Different repo
      3 // shorter lookback
    );
    
    if (result2.success) {
      displayAnalysisResults(result2.triageInput, result2.suspectedCommits, 'Scenario 2');
      console.log('✅ Test Scenario 2: SUCCESS');
    } else {
      console.log(`❌ Test Scenario 2: FAILED - ${result2.error}`);
    }
    
    // Test Scenario 3: No repository (parsing only)
    console.log('\n🔬 Test Scenario 3: Parsing Only (No Repository)');
    console.log('-' .repeat(50));
    
    const result3 = await testTriageSplunkErrorTool(
      rawEventJson,
      '', // no repository
      7
    );
    
    if (result3.success) {
      displayAnalysisResults(result3.triageInput, result3.suspectedCommits, 'Scenario 3');
      console.log('✅ Test Scenario 3: SUCCESS (Parsing only)');
    } else {
      console.log(`❌ Test Scenario 3: FAILED - ${result3.error}`);
    }
    
    // Test Scenario 4: Error handling - invalid JSON
    console.log('\n🔬 Test Scenario 4: Error Handling - Invalid JSON');
    console.log('-' .repeat(50));
    
    const result4 = await testTriageSplunkErrorTool(
      '{ invalid json', // Invalid JSON
      'wexhealth/test-repo',
      7
    );
    
    if (!result4.success) {
      console.log(`✅ Test Scenario 4: Successfully caught error - ${result4.error}`);
    } else {
      console.log('❌ Test Scenario 4: Expected to fail but succeeded');
    }
    
    // Test Scenario 5: Validate expected output format
    console.log('\n🔬 Test Scenario 5: Output Format Validation');
    console.log('-' .repeat(50));
    
    const result5 = await testTriageSplunkErrorTool(rawEventJson, 'wexhealth/test-repo', 7);
    if (result5.success) {
      const triageInput = result5.triageInput;
      
      // Validate expected fields
      const validations = [
        { name: 'Service Name', value: triageInput.serviceName, expected: 'WexHealth.CDH.Web.Consumer' },
        { name: 'Environment', value: triageInput.environment, expected: 'QA' },
        { name: 'Exception Type', value: triageInput.exceptionType, expected: 'WEXHealth.Enterprise.DocumentIndex.SDK.DocumentIndexApiException' },
        { name: 'Error Message not empty', value: triageInput.errorMessage.length > 0, expected: true },
        { name: 'Stack Trace not empty', value: triageInput.stackTrace.length > 0, expected: true },
        { name: 'Search Keywords Files', value: triageInput.searchKeywords.files.length > 0, expected: true },
        { name: 'Search Keywords Methods', value: triageInput.searchKeywords.methods.length > 0, expected: true }
      ];
      
      console.log('\n📊 Validation Results:');
      let passedCount = 0;
      for (const validation of validations) {
        const passed = validation.value === validation.expected;
        console.log(`${passed ? '✅' : '❌'} ${validation.name}: ${passed ? 'PASS' : 'FAIL'}`);
        if (!passed) {
          console.log(`   Expected: ${validation.expected}`);
          console.log(`   Actual:   ${validation.value}`);
        }
        if (passed) passedCount++;
      }
      
      console.log(`\n📈 Validation Summary: ${passedCount}/${validations.length} tests passed`);
      
      if (passedCount === validations.length) {
        console.log('✅ Test Scenario 5: All validations PASSED');
      } else {
        console.log('⚠️  Test Scenario 5: Some validations FAILED');
      }
    } else {
      console.log(`❌ Test Scenario 5: FAILED - ${result5.error}`);
    }
    
    console.log('\n🎉 All test scenarios completed!');
    
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
🧪 TriageSplunkErrorTool Test Suite
===================================

This test script validates the triageSplunkErrorTool function using real Splunk data.

Environment Variables (Optional):
  GITHUB_TOKEN - GitHub token for commit analysis

Test Scenarios:
  1. Complete analysis with GitHub repository
  2. Different repository configuration
  3. Parsing only (no repository)
  4. Error handling (invalid JSON)
  5. Output format validation

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
  
  console.log('🚀 TriageSplunkErrorTool Test Suite Starting...');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  
  // Check environment
  console.log('\n🌍 Environment Check:');
  console.log(`  GitHub Token: ${process.env.GITHUB_TOKEN ? '✅ Configured' : '❌ Not configured (GitHub analysis will be skipped for some tests)'}`);
  
  await runTestScenarios();
  
  console.log(`\n📅 Completed at: ${new Date().toISOString()}`);
  console.log('🏁 TriageSplunkErrorTool test suite finished!');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unhandled error in test suite:', error);
    process.exit(1);
  });
}

export { loadRawTestData, testTriageSplunkErrorTool, runTestScenarios };

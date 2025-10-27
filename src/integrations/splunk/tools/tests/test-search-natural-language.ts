/**
 * Test script for the AI-powered natural language Splunk search tool
 * 
 * This script tests the search_splunk tool that converts natural language
 * queries to SPL and executes them against Splunk.
 * 
 * Prerequisites:
 * - .env file with SPLUNK_HOST, SPLUNK_TOKEN configured
 * - .env file with OPENAI_API_KEY, OPENAI_API_BASE_URL configured
 * - Splunk instance accessible and running
 * 
 * Usage: npx tsx src/integrations/splunk/tools/tests/test-search-natural-language.ts
 */

import 'dotenv/config';
import { buildSplunkQueryFromNL } from '../../../../triage/splunkQueryBuilder.js';
import { getSplunkClient, initializeSplunkClient } from '../../client.js';
import { getSplunkConfig } from '../../../../configStore.js';
import { resolve } from 'path';

interface TestCase {
  name: string;
  naturalLanguageQuery: string;
  expectedPatterns?: string[]; // Patterns we expect to see in the generated SPL
  earliestTime?: string;
  latestTime?: string;
}

const testCases: TestCase[] = [
  {
    name: "Simple error search for Consumer Portal in Production",
    naturalLanguageQuery: "show me errors for the consumer portal in prod",
    expectedPatterns: ["index=applogs", "Error", "WexHealth.CDH.Web.Consumer", "PROD"]
  },
  {
    name: "CIP errors in last hour",
    naturalLanguageQuery: "find errors in cip from the last hour",
    expectedPatterns: ["index=applogs", "WexHealth.CDH.ConsumerInvestment.Portal"],
    earliestTime: "-1h",
    latestTime: "now"
  },
  {
    name: "Auth service exceptions in QA",
    naturalLanguageQuery: "show exceptions in auth service qa environment",
    expectedPatterns: ["index=applogs", "WexHealth.Apps.Web.EmployerPortal.Auth", "QA"]
  },
  {
    name: "Count errors by application",
    naturalLanguageQuery: "count errors by application in production",
    expectedPatterns: ["index=applogs", "stats count", "PROD"]
  },
  {
    name: "Admin Portal errors over time",
    naturalLanguageQuery: "show me admin portal errors over time in prod",
    expectedPatterns: ["index=applogs", "WexHealth.CDH.Web.Administrator", "timechart"]
  },
  {
    name: "Data API recent logs",
    naturalLanguageQuery: "show recent logs for data api in staging",
    expectedPatterns: ["index=applogs", "WexHealth.CDH.Apps.Web.Data.Api", "STG"]
  },
  {
    name: "NESW exceptions with details",
    naturalLanguageQuery: "find all exceptions in new employer setup wizard with stack traces",
    expectedPatterns: ["index=applogs", "WexHealth.CDH.NewEmployerSetup.Portal", "@x"]
  },
  {
    name: "Employer Portal table output",
    naturalLanguageQuery: "show me employer portal errors in a table with time, message, and user",
    expectedPatterns: ["index=applogs", "WexHealth.Apps.Web.EmployerPortal", "table"]
  }
];

async function testQueryGeneration() {
  console.log('\n🧪 ============================================');
  console.log('   Testing Natural Language to SPL Generation');
  console.log('   ============================================\n');

  const friendlyRepoPath = resolve(process.cwd(), 'src/integrations/splunk/friendlyRepo.json');
  const sampleQueriesPath = resolve(process.cwd(), 'src/integrations/splunk/sampleQueries.json');

  let passCount = 0;
  let failCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📝 Test ${i + 1}/${testCases.length}: ${testCase.name}`);
    console.log(`   Natural Language: "${testCase.naturalLanguageQuery}"`);
    
    try {
      const startTime = Date.now();
      const generatedSPL = await buildSplunkQueryFromNL(
        testCase.naturalLanguageQuery,
        friendlyRepoPath,
        sampleQueriesPath
      );
      const endTime = Date.now();
      
      console.log(`   ✅ Generated SPL (${endTime - startTime}ms):`);
      console.log(`      ${generatedSPL}`);
      
      // Check if expected patterns are present (if specified)
      if (testCase.expectedPatterns) {
        let allPatternsFound = true;
        const missingPatterns: string[] = [];
        
        for (const pattern of testCase.expectedPatterns) {
          if (!generatedSPL.toLowerCase().includes(pattern.toLowerCase())) {
            allPatternsFound = false;
            missingPatterns.push(pattern);
          }
        }
        
        if (allPatternsFound) {
          console.log(`   ✓ All expected patterns found`);
          passCount++;
        } else {
          console.log(`   ⚠️  Missing patterns: ${missingPatterns.join(', ')}`);
          failCount++;
        }
      } else {
        passCount++;
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failCount++;
    }
  }

  console.log('\n📊 Query Generation Summary:');
  console.log(`   Passed: ${passCount}/${testCases.length}`);
  console.log(`   Failed: ${failCount}/${testCases.length}`);
  
  return { passCount, failCount };
}

async function testFullSearchExecution() {
  console.log('\n🧪 ============================================');
  console.log('   Testing Full Splunk Search Execution');
  console.log('   ============================================\n');

  // Test with a simple, safe query that should return results quickly
  const testQuery = "show me logs from admin portal in the last 5 minutes";
  
  console.log(`📝 Test Query: "${testQuery}"`);
  console.log(`⏰ Time Range: -5m to now\n`);

  try {
    // Generate SPL
    const friendlyRepoPath = resolve(process.cwd(), 'src/integrations/splunk/friendlyRepo.json');
    const sampleQueriesPath = resolve(process.cwd(), 'src/integrations/splunk/sampleQueries.json');
    
    console.log('🔄 Step 1: Generating SPL query...');
    const splQuery = await buildSplunkQueryFromNL(testQuery, friendlyRepoPath, sampleQueriesPath);
    console.log(`   Generated: ${splQuery}\n`);
    
    // Initialize Splunk client
    console.log('🔄 Step 2: Initializing Splunk client...');
    const splunkConfig = await getSplunkConfig();
    initializeSplunkClient(splunkConfig);
    const client = getSplunkClient();
    console.log('   ✅ Splunk client initialized\n');
    
    // Create search job
    console.log('🔄 Step 3: Creating Splunk search job...');
    const jobResponse = await client.search.createJob(splQuery, '-5m', 'now');
    console.log(`   ✅ Job created with SID: ${jobResponse.sid}\n`);
    
    // Get results
    console.log('🔄 Step 4: Fetching results (first 25 items)...');
    const resultsResponse = await client.search.getJobResults(jobResponse.sid, 25, 0);
    const results = resultsResponse.results || [];
    console.log(`   ✅ Retrieved ${results.length} results\n`);
    
    // Display sample results
    if (results.length > 0) {
      console.log('📋 Sample Results (first 3 items):');
      const sampleResults = results.slice(0, 3);
      console.log(JSON.stringify(sampleResults, null, 2));
    } else {
      console.log('   ℹ️  No results found (this is okay - might be no logs in the last 5 minutes)');
    }
    
    console.log('\n✅ Full search execution test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Full search execution test failed:');
    console.error(error);
    return false;
  }
}

async function testEdgeCases() {
  console.log('\n🧪 ============================================');
  console.log('   Testing Edge Cases');
  console.log('   ============================================\n');

  const edgeCases = [
    {
      name: "Very vague query",
      query: "show me stuff"
    },
    {
      name: "Query with typo in app name",
      query: "errors in consumr portal" // typo: consumr instead of consumer
    },
    {
      name: "Complex multi-condition query",
      query: "show me critical errors and fatal exceptions in cip or auth service during production in the last 24 hours sorted by time"
    }
  ];

  const friendlyRepoPath = resolve(process.cwd(), 'src/integrations/splunk/friendlyRepo.json');
  const sampleQueriesPath = resolve(process.cwd(), 'src/integrations/splunk/sampleQueries.json');

  for (const edgeCase of edgeCases) {
    console.log(`\n📝 Edge Case: ${edgeCase.name}`);
    console.log(`   Query: "${edgeCase.query}"`);
    
    try {
      const generatedSPL = await buildSplunkQueryFromNL(
        edgeCase.query,
        friendlyRepoPath,
        sampleQueriesPath
      );
      console.log(`   ✅ Generated: ${generatedSPL}`);
    } catch (error) {
      console.log(`   ⚠️  Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Natural Language Splunk Search Tool - Test Suite     ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  try {
    // Test 1: Query Generation
    const genResults = await testQueryGeneration();
    
    // Test 2: Edge Cases
    await testEdgeCases();
    
    // Test 3: Full Search Execution (optional - requires Splunk connection)
    console.log('\n❓ Do you want to test full search execution?');
    console.log('   This requires a working Splunk connection.');
    console.log('   Proceeding with full execution test...\n');
    
    await testFullSearchExecution();
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  Test Suite Complete                                   ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('\n✨ All tests completed!\n');
    
  } catch (error) {
    console.error('\n❌ Test suite failed with error:');
    console.error(error);
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(console.error);


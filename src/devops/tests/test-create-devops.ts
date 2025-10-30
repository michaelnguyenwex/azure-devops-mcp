/**
 * Test script for createDevOpsStory function
 * 
 * Required environment variables:
 * - AZDO_PAT: Azure DevOps Personal Access Token
 * - AZDO_ORG: Azure DevOps organization name (e.g., WexHealthTech)
 * - AZDO_PROJECT: Azure DevOps project name (e.g., Health)
 * - OPENAI_API_KEY: OpenAI API key
 * - OPENAI_API_BASE_URL: OpenAI API base URL
 * - GITHUB_TOKEN or GITHUB_PAT: GitHub personal access token
 * 
 * Usage:
 *   npm run build
 *   node build/devops/tests/test-create-devops.js
 */

import 'dotenv/config';
import { createDevOpsStory } from '../create-devops.js';

async function runTest() {
  console.log('='.repeat(80));
  console.log('Testing createDevOpsStory Function');
  console.log('='.repeat(80));
  
  // Sample test inputs
  const testCases = [
    {
      name: 'Remove Feature Flag',
      input: 'remove ff https://github.com/wexinc/health-cdh-investment-api/pull/757'
    },
    // Add more test cases as needed:
    // {
    //   name: 'Create Feature Flag',
    //   input: 'create ff https://github.com/WEXHealthTech/health-cdh-authservice/pull/123'
    // },
    // {
    //   name: 'Run Pipeline',
    //   input: 'run pipeline https://github.com/WEXHealthTech/health-cdh-authservice/pull/789'
    // }
  ];
  
  // Validate environment variables
  console.log('\n📋 Checking environment variables...');
  const requiredEnvVars = [
    'AZDO_PAT',
    'AZDO_ORG',
    'AZDO_PROJECT',
    'OPENAI_API_KEY',
    'OPENAI_API_BASE_URL'
  ];
  
  const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  if (!githubToken) {
    requiredEnvVars.push('GITHUB_TOKEN or GITHUB_PAT');
  }
  
  const missingVars = requiredEnvVars.filter(varName => {
    if (varName === 'GITHUB_TOKEN or GITHUB_PAT') {
      return !githubToken;
    }
    return !process.env[varName];
  });
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease set these environment variables before running the test.');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set');
  console.log(`   - AZDO_ORG: ${process.env.AZDO_ORG}`);
  console.log(`   - AZDO_PROJECT: ${process.env.AZDO_PROJECT}`);
  console.log(`   - OPENAI_API_BASE_URL: ${process.env.OPENAI_API_BASE_URL}`);
  console.log(`   - GITHUB_TOKEN: ${githubToken ? '***' + githubToken.slice(-4) : 'not set'}`);
  
  // Run test cases
  let passedTests = 0;
  let failedTests = 0;
  
  for (const testCase of testCases) {
    console.log('\n' + '='.repeat(80));
    console.log(`🧪 Test Case: ${testCase.name}`);
    console.log('='.repeat(80));
    console.log(`📝 Input: "${testCase.input}"`);
    console.log('\n');
    
    try {
      const result = await createDevOpsStory(testCase.input);
      
      console.log('\n' + '✅'.repeat(40));
      console.log('✅ TEST PASSED');
      console.log('✅'.repeat(40));
      console.log('\n📊 Result Summary:');
      console.log(`   - Work Item ID: ${result.id}`);
      console.log(`   - Work Item Type: ${result.fields?.['System.WorkItemType']}`);
      console.log(`   - Title: ${result.fields?.['System.Title']}`);
      console.log(`   - State: ${result.fields?.['System.State']}`);
      
      if (result._links?.html?.href) {
        console.log(`   - URL: ${result._links.html.href}`);
      }
      
      console.log('\n📄 Full Result:');
      console.log(JSON.stringify(result, null, 2));
      
      passedTests++;
      
    } catch (error: any) {
      console.log('\n' + '❌'.repeat(40));
      console.log('❌ TEST FAILED');
      console.log('❌'.repeat(40));
      console.error('\n💥 Error Details:');
      console.error(`   - Message: ${error.message}`);
      if (error.response) {
        console.error(`   - Status: ${error.response.status}`);
        console.error(`   - Status Text: ${error.response.statusText}`);
        if (error.response.data) {
          console.error(`   - Response Data:`, JSON.stringify(error.response.data, null, 2));
        }
      }
      console.error('\n📚 Stack Trace:');
      console.error(error.stack);
      
      failedTests++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log('='.repeat(80));
  
  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run the test
runTest().catch(error => {
  console.error('\n💥 Unexpected error running tests:');
  console.error(error);
  process.exit(1);
});


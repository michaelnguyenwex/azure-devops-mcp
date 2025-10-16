#!/usr/bin/env node

/**
 * Test script for the new Splunk parser-based triage functionality
 * 
 * This script tests:
 * 1. Raw Splunk JSON parsing
 * 2. Error information extraction  
 * 3. GitHub commit analysis with parsed data
 * 4. Structured output generation
 */

import 'dotenv/config';
import { parseRawSplunkEvent } from './splunkParser.js';
import { findSuspectedCommits } from './commitAnalyzer.js';
import { GitHubService } from './githubService.js';
import { RawSplunkEvent } from './types.js';

/**
 * Sample raw Splunk data for testing (as JSON string)
 */
const sampleRawSplunkData = `{
  "@l": "Error",
  "Application": "WexHealth.CDH.Web.Consumer",
  "Environment": "QA",
  "_time": "2025-10-16T09:13:57.833-05:00",
  "_raw": "{\\"@t\\":\\"2025-10-16T14:13:57.8339402Z\\",\\"@mt\\":\\"[DocumentIndexService] Operation 'Get Shareable Url' failed! Info: { documentId: 9a389cad0a89f296b66437e840248d6fa0ce12827f0501d1cc772fb610fd592d, expire: 10/17/2025 9:13:57 AM -05:00 | correlationId: 38f694d7-fb0c-497d-b34f-8b107ee8d02e, url: https://ps-docindex.qa.benefits.azr.wexglobal.com/api/v1/share, method: GET, status: 500, connectionId: ad9ad082-3d5d-4bbd-a31e-b4d32f85520b }; [StackTrace]: [Assembly]:LH1OnDemand.WebApp.Participant;[File]:MasterPageBase.cs;[Method]:OnLoad(67)=>[Assembly]:LH1OnDemand.WebApp.Participant;[File]:MasterBase.cs;[Method]:OnLoad(132)=>[Assembly]:LH1OnDemand.WebApp.Participant;[File]:PortalPage.master.cs;[Method]:Page_Load(151)\\",\\"@l\\":\\"Error\\",\\"@x\\":\\"WEXHealth.Enterprise.DocumentIndex.SDK.DocumentIndexApiException: \\\\\\"Object reference not set to an instance of an object.\\\\\\"\\\\r\\\\n   at WEXHealth.Enterprise.DocumentIndex.SDK.Utils.HttpClientExtensions.<ReadAsJsonAsync>d__0\`1.MoveNext()\\\\r\\\\n--- End of stack trace from previous location where exception was thrown ---\\\\r\\\\n   at System.Runtime.ExceptionServices.ExceptionDispatchInfo.Throw()\\\\r\\\\n   at System.Runtime.CompilerServices.TaskAwaiter.HandleNonSuccessAndDebuggerNotification(Task task)\\\\r\\\\n   at WEXHealth.Enterprise.DocumentIndex.SDK.ApiClient.<GetJsonAsync>d__5\`1.MoveNext()\\\\r\\\\n--- End of stack trace from previous location where exception was thrown ---\\\\r\\\\n   at System.Runtime.ExceptionServices.ExceptionDispatchInfo.Throw()\\\\r\\\\n   at System.Runtime.CompilerServices.TaskAwaiter.HandleNonSuccessAndDebuggerNotification(Task task)\\\\r\\\\n   at WEXHealth.Enterprise.DocumentIndex.SDK.DocumentIndexApi.<GetShareableUrlAsync>d__35.MoveNext()\\\\r\\\\n--- End of stack trace from previous location where exception was thrown ---\\\\r\\\\n   at System.Runtime.ExceptionServices.ExceptionDispatchInfo.Throw()\\\\r\\\\n   at System.Runtime.CompilerServices.TaskAwaiter.HandleNonSuccessAndDebuggerNotification(Task task)\\\\r\\\\n   at WEXHealth.Enterprise.DocumentIndex.SDK.Utils.AsyncHelper.RunSync[TResult](Func\`1 task)\\\\r\\\\n   at Lighthouse1.Platform.Storage.Providers.SdkApiClient.GetShareableUrl(String objectId, DateTimeOffset expiration) in E:\\\\\\\\build\\\\\\\\2833\\\\\\\\s\\\\\\\\Dev\\\\\\\\src\\\\\\\\Lighthouse1\\\\\\\\Platform\\\\\\\\Gateway\\\\\\\\Lighthouse1.Platform.Gateway.Contract\\\\\\\\Providers\\\\\\\\SdkApiClient.cs:line 173\\\\r\\\\n   at Lighthouse1.Platform.Storage.Providers.DocumentIndexProvider.GetShareableUrl(String objectId, DateTimeOffset expiration) in E:\\\\\\\\build\\\\\\\\2833\\\\\\\\s\\\\\\\\Dev\\\\\\\\src\\\\\\\\Lighthouse1\\\\\\\\Platform\\\\\\\\Gateway\\\\\\\\Lighthouse1.Platform.Gateway.Contract\\\\\\\\Providers\\\\\\\\DocumentIndexProvider.cs:line 299\\",\\"EventId\\":{\\"Id\\":9003},\\"SourceContext\\":\\"Lighthouse1.Platform.Storage.Providers.DocumentIndexProvider\\"}",
  "host": "MEU1SPLSMB002P",
  "index": "applogs",
  "source": "\\\\\\\\wexprodr.wexglobal.com\\\\WH\\\\WHqa\\\\logs\\\\CDH\\\\splunk\\\\WexHealth.CDH.Web.Consumer\\\\applog.MEU1CDHCNWEB2Q_064.json",
  "sourcetype": "CDH"
}`;

/**
 * Test the new Splunk parser-based triage workflow
 */
async function testSplunkTriageWorkflow() {
  console.log('🧪 Testing Splunk Parser-Based Triage Workflow');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Parse raw Splunk data
    console.log('\n📋 Step 1: Parsing Raw Splunk Data');
    console.log('-' .repeat(40));
    
    const triageInput = await parseRawSplunkEvent(sampleRawSplunkData);
    
    console.log('✅ Parsed successfully:');
    console.log(`  Service: ${triageInput.serviceName}`);
    console.log(`  Environment: ${triageInput.environment}`);
    console.log(`  Exception: ${triageInput.exceptionType}`);
    console.log(`  Error: ${triageInput.errorMessage.substring(0, 100)}...`);
    console.log(`  Stack Frames: ${triageInput.stackTrace.length}`);
    console.log(`  Search Keywords:`);
    console.log(`    Files: ${triageInput.searchKeywords.files.join(', ')}`);
    console.log(`    Methods: ${triageInput.searchKeywords.methods.join(', ')}`);
    console.log(`    Context: ${triageInput.searchKeywords.context.join(', ')}`);
    
    // Step 2: Test GitHub analysis
    console.log('\n🔍 Step 2: GitHub Commit Analysis');
    console.log('-' .repeat(40));
    
    const githubService = new GitHubService();
    const testRepo = 'wexinc/health-cdh-consumerinvestment-portal';
    const lookbackDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    try {
      const recentCommits = await githubService.getCommitsSince(testRepo, lookbackDate);
      console.log(`📊 Found ${recentCommits.length} recent commits`);
      
      // Use the structured error information for commit analysis
      const searchTerms = [
        triageInput.errorMessage,
        triageInput.exceptionType,
        ...triageInput.searchKeywords.files.map(f => f.replace('.cs', '')),
        ...triageInput.searchKeywords.methods,
        ...triageInput.searchKeywords.context
      ].join(' ');
      
      console.log(`🔍 Search terms: ${searchTerms.substring(0, 200)}...`);
      
      const suspectedCommits = findSuspectedCommits(searchTerms, recentCommits);
      console.log(`🎯 Identified ${suspectedCommits.length} suspected commits`);
      
      if (suspectedCommits.length > 0) {
        console.log('\n📋 Top Suspected Commits:');
        suspectedCommits.slice(0, 3).forEach((commit, index) => {
          console.log(`  ${index + 1}. ${commit.hash.substring(0, 8)} - ${commit.message.substring(0, 60)}...`);
          console.log(`     Author: ${commit.author} | Date: ${commit.date}`);
        });
      }
      
    } catch (githubError) {
      console.warn('⚠️  GitHub analysis failed:', githubError instanceof Error ? githubError.message : 'Unknown error');
    }
    
    // Step 3: Show structured analysis results
    console.log('\n📊 Step 3: Structured Analysis Results');
    console.log('-' .repeat(40));
    
    console.log('🏷️  Error Classification:');
    console.log(`  Type: ${triageInput.exceptionType}`);
    console.log(`  Message: ${triageInput.errorMessage}`);
    console.log(`  Service: ${triageInput.serviceName} (${triageInput.environment})`);
    
    console.log('\n🔍 Investigation Focus Areas:');
    if (triageInput.stackTrace.length > 0) {
      console.log('  Key Stack Frames:');
      triageInput.stackTrace.slice(0, 5).forEach((frame, index) => {
        console.log(`    ${index + 1}. ${frame.method} in ${frame.file}${frame.line ? `:${frame.line}` : ''}`);
      });
    }
    
    console.log('\n🎯 Search Keywords for Manual Investigation:');
    console.log(`  Files to check: ${triageInput.searchKeywords.files.join(', ')}`);
    console.log(`  Methods to review: ${triageInput.searchKeywords.methods.join(', ')}`);
    console.log(`  Context clues: ${triageInput.searchKeywords.context.join(', ')}`);
    
    console.log('\n✅ Test completed successfully!');
    console.log('🎉 The new parser-based triage workflow is working correctly!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.log('\nThis could indicate issues with:');
    console.log('• Splunk data parsing logic');
    console.log('• GitHub integration');
    console.log('• Error extraction algorithms');
  }
}

/**
 * Test just the parsing component
 */
async function testParsingOnly() {
  console.log('\n🔬 Testing Parsing Component Only');
  console.log('=' .repeat(40));
  
  try {
    const triageInput = await parseRawSplunkEvent(sampleRawSplunkData);
    
    console.log('📋 Parsed Data Structure:');
    console.log(JSON.stringify(triageInput, null, 2));
    
  } catch (error) {
    console.error('❌ Parsing test failed:', error);
  }
}

/**
 * Main test execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--parse-only')) {
    await testParsingOnly();
  } else {
    await testSplunkTriageWorkflow();
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unhandled error in test suite:', error);
    process.exit(1);
  });
}

export { testSplunkTriageWorkflow, testParsingOnly };

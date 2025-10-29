import { GitHubService } from '../githubService.js';
import 'dotenv/config';

/**
 * Test script for the getAppNameFromPR function
 * 
 * This demonstrates how to extract AppName from health-benefits-app-config
 * based on a PR URL from a source repository.
 */
async function testGetAppNameFromPR() {
  console.log('=== Testing GitHub AppName Lookup ===\n');

  const githubService = new GitHubService();

  // Example PR URL - replace with actual PR URL
  // Format: https://github.com/owner/repo/pull/123
  const prUrl = 'https://github.com/wexinc/health-cdh-authservice/pull/60';

  console.log(`Testing with PR URL: ${prUrl}\n`);

  try {
    const result = await githubService.getAppNameFromPR(prUrl);

    if (result) {
      console.log('\n✅ SUCCESS! Found AppName configuration:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`AppName:     ${result.appName}`);
      console.log(`Repo Name:   ${result.repoName}`);
      console.log(`Config Path: ${result.configPath}`);
      
      if (result.prDetails) {
        console.log('\nPR Details:');
        console.log(`  PR #${result.prDetails.number}: ${result.prDetails.title}`);
        console.log(`  Description: ${result.prDetails.description.substring(0, 100)}...`);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      console.log('\n❌ Could not find AppName configuration');
      console.log('Possible reasons:');
      console.log('  - Repo folder not found in health-benefits-app-config');
      console.log('  - wexhealth.host.json file missing in qa folder');
      console.log('  - AppName field not present in JSON file');
      console.log('  - Invalid PR URL format\n');
    }
  } catch (error) {
    console.error('\n❌ Error occurred:', error);
  }
}

/**
 * Test with custom config repo parameters
 */
async function testGetAppNameWithCustomParams() {
  console.log('\n=== Testing with Custom Parameters ===\n');

  const githubService = new GitHubService();

  const prUrl = 'https://github.com/wexinc/health-cdh-authservice/pull/60';
  const configRepoOwner = 'WexHealthTech';
  const configRepoName = 'health-benefits-app-config';
  const branch = 'main'; // or 'master', 'develop', etc.

  console.log(`PR URL:             ${prUrl}`);
  console.log(`Config Repo Owner:  ${configRepoOwner}`);
  console.log(`Config Repo Name:   ${configRepoName}`);
  console.log(`Branch:             ${branch}\n`);

  try {
    const result = await githubService.getAppNameFromPR(
      prUrl,
      configRepoOwner,
      configRepoName,
      branch
    );

    if (result) {
      console.log(`\n✅ AppName: ${result.appName}`);
    } else {
      console.log('\n❌ Could not find AppName');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

/**
 * Test PR details retrieval
 */
async function testGetPRDetails() {
  console.log('\n=== Testing PR Details Retrieval ===\n');

  const githubService = new GitHubService();

  const repoName = 'WexHealthTech/cdh-employerportal-az-cd';
  const pullNumber = 123;

  console.log(`Fetching PR #${pullNumber} from ${repoName}\n`);

  try {
    const prDetails = await githubService.getPullRequestDetails(repoName, pullNumber);

    if (prDetails) {
      console.log('\n✅ PR Details:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Number:      #${prDetails.number}`);
      console.log(`Title:       ${prDetails.title}`);
      console.log(`State:       ${prDetails.state}`);
      console.log(`Author:      ${prDetails.author}`);
      console.log(`Created:     ${prDetails.createdAt}`);
      console.log(`Updated:     ${prDetails.updatedAt}`);
      console.log(`Merged:      ${prDetails.mergedAt || 'Not merged'}`);
      console.log(`URL:         ${prDetails.htmlUrl}`);
      console.log('\nDescription:');
      console.log(prDetails.description || '(No description)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      console.log('\n❌ Could not fetch PR details');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

// Run the tests
async function runAllTests() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  GitHub Service - AppName Lookup Test Suite         ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Test 1: Basic AppName lookup
  await testGetAppNameFromPR();

  // Test 2: PR details only
  await testGetPRDetails();

  // Test 3: Custom parameters
  await testGetAppNameWithCustomParams();

  console.log('\n✨ All tests completed!\n');
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { testGetAppNameFromPR, testGetPRDetails, testGetAppNameWithCustomParams };


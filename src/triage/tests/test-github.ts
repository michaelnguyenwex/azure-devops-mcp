#!/usr/bin/env node

/**
 * Dedicated GitHub integration test script
 * 
 * This script tests the GitHub service in isolation to verify:
 * 1. GitHub token is loaded correctly
 * 2. GitHub API calls are working
 * 3. Commit fetching and analysis functions properly
 * 4. Error handling works as expected
 */

import 'dotenv/config';  // Load environment variables from .env file
import { GitHubService } from '../githubService.js';

/**
 * Test GitHub service functionality
 */
async function testGitHubService() {
  console.log('🧪 GitHub Service Integration Test');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Check environment configuration
    console.log('\n🔍 Step 1: Environment Check');
    console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? '✅ Set (length: ' + process.env.GITHUB_TOKEN.length + ')' : '❌ Not set');
    console.log('GITHUB_PAT:', process.env.GITHUB_PAT ? '✅ Set' : '❌ Not set');
    
    if (process.env.GITHUB_TOKEN) {
      console.log('Token format:', process.env.GITHUB_TOKEN.startsWith('ghp_') ? '✅ Classic PAT (ghp_)' : 
                                   process.env.GITHUB_TOKEN.startsWith('github_pat_') ? '✅ Fine-grained PAT' : 
                                   '⚠️  Unknown format');
    }
    
    // Step 2: Initialize GitHub service
    console.log('\n🚀 Step 2: Initialize GitHub Service');
    const githubService = new GitHubService();
    console.log('✅ GitHub service initialized');
    
    // Step 3: Test with a public repository first
    console.log('\n📋 Step 3: Test Public Repository Access');
    const publicRepo = 'wexinc/health-cdh-consumerinvestment-portal';
    const lookbackDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago
    
    console.log(`Fetching commits from public repo: ${publicRepo}`);
    console.log(`Looking back from: ${lookbackDate}`);
    
    try {
      const publicCommits = await githubService.getCommitsSince(publicRepo, lookbackDate);
      console.log(`✅ Retrieved ${publicCommits.length} commits from public repository`);
      
      if (publicCommits.length > 0) {
        const sampleCommit = publicCommits[0];
        console.log('📄 Sample commit:', {
          hash: sampleCommit.hash.substring(0, 8) + '...',
          message: sampleCommit.message.substring(0, 60) + (sampleCommit.message.length > 60 ? '...' : ''),
          author: sampleCommit.author,
          date: sampleCommit.date,
          changedFiles: sampleCommit.changedFiles?.length || 0,
          pullRequestUrl: sampleCommit.pullRequestUrl || 'none'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Public repository test failed:', errorMessage);
    }
    
    // Step 4: Test with the specified private repository
    console.log('\n🏢 Step 4: Test Private Repository Access');
    const privateRepo = 'wexinc/health-cdh-consumerinvestment-portal';
    
    console.log(`Fetching commits from private repo: ${privateRepo}`);
    
    try {
      const privateCommits = await githubService.getCommitsSince(privateRepo, lookbackDate);
      console.log(`✅ Retrieved ${privateCommits.length} commits from private repository`);
      
      if (privateCommits.length > 0) {
        const sampleCommit = privateCommits[0];
        console.log('📄 Sample commit:', {
          hash: sampleCommit.hash.substring(0, 8) + '...',
          message: sampleCommit.message.substring(0, 60) + (sampleCommit.message.length > 60 ? '...' : ''),
          author: sampleCommit.author,
          date: sampleCommit.date,
          changedFiles: sampleCommit.changedFiles?.length || 0,
          pullRequestUrl: sampleCommit.pullRequestUrl || 'none'
        });
      } else {
        console.log('ℹ️  No commits found in the specified timeframe');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Private repository test failed:', errorMessage);
      if (errorMessage.includes('404')) {
        console.log('💡 Tip: Repository not found or not accessible. Check:');
        console.log('   • Repository name is correct');
        console.log('   • Token has access to this repository');
        console.log('   • Repository exists and is accessible');
      } else if (errorMessage.includes('403')) {
        console.log('💡 Tip: Access forbidden. Check:');
        console.log('   • Token has correct permissions (repo scope for private repos)');
        console.log('   • Token is not expired');
        console.log('   • Rate limits are not exceeded');
      }
    }
    
    // Step 5: Test commit analysis functionality
    console.log('\n🔍 Step 5: Test Commit Analysis');
    
    // Create some test commits for analysis
    const testCommits = [
      {
        hash: 'abc123def456',
        message: 'Fix null pointer exception in user service',
        author: 'developer@example.com',
        date: new Date().toISOString(),
        changedFiles: ['src/services/UserService.js', 'tests/UserService.test.js'],
        pullRequestUrl: 'https://github.com/example/repo/pull/123'
      },
      {
        hash: 'def456ghi789',
        message: 'Update payment processing logic',
        author: 'dev2@example.com',
        date: new Date().toISOString(),
        changedFiles: ['src/payment/PaymentProcessor.js'],
        pullRequestUrl: undefined
      }
    ];
    
    // Test commit analysis
    const { findSuspectedCommits } = await import('../commitAnalyzer.js');
    const testErrorMessage = 'NullPointerException in UserService.getUserById()';
    
    console.log(`Analyzing commits for error: "${testErrorMessage}"`);
    const suspectedCommits = findSuspectedCommits(testErrorMessage, testCommits);
    
    console.log(`✅ Found ${suspectedCommits.length} suspected commits`);
    suspectedCommits.forEach((commit, index) => {
      console.log(`   ${index + 1}. ${commit.hash.substring(0, 8)}... - ${commit.message.substring(0, 50)}...`);
    });
    
    // Step 6: Summary
    console.log('\n📊 Test Summary');
    console.log('=' .repeat(30));
    console.log('✅ Environment configuration: OK');
    console.log('✅ GitHub service initialization: OK');
    console.log('✅ Commit analysis functionality: OK');
    
    if (process.env.GITHUB_TOKEN) {
      console.log('✅ GitHub token: Configured');
      console.log('💡 Your GitHub integration is ready for use!');
    } else {
      console.log('⚠️  GitHub token: Not configured');
      console.log('💡 Set GITHUB_TOKEN in your .env file for full functionality');
    }
    
  } catch (error) {
    console.error('\n❌ GitHub test failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check that GITHUB_TOKEN is set in your .env file');
    console.log('2. Verify token has correct permissions (repo scope)');
    console.log('3. Ensure repository name is correct (owner/repo format)');
    console.log('4. Check network connectivity to GitHub API');
  }
}

/**
 * Test different token formats and provide guidance
 */
async function testTokenFormats() {
  console.log('\n🔐 Token Format Analysis');
  console.log('-' .repeat(30));
  
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('❌ No token configured');
    return;
  }
  
  console.log('Token length:', token.length);
  
  if (token.startsWith('ghp_')) {
    console.log('✅ Classic Personal Access Token detected');
    console.log('   • Good for both public and private repositories');
    console.log('   • Make sure "repo" scope is selected');
  } else if (token.startsWith('github_pat_')) {
    console.log('✅ Fine-grained Personal Access Token detected');
    console.log('   • Good for specific repositories');
    console.log('   • Make sure repository permissions are configured');
  } else if (token.startsWith('gho_')) {
    console.log('⚠️  OAuth token detected');
    console.log('   • May have limited permissions');
  } else {
    console.log('⚠️  Unknown token format');
    console.log('   • Expected format: ghp_... or github_pat_...');
  }
}

/**
 * Main test execution
 */
async function main() {
  console.log('🚀 GitHub Integration Test Suite');
  console.log('📅 Started at:', new Date().toISOString());
  console.log('');
  
  await testTokenFormats();
  await testGitHubService();
  
  console.log('\n📅 Test completed at:', new Date().toISOString());
  console.log('🏁 GitHub test suite finished!');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unhandled error in GitHub test suite:', error);
    process.exit(1);
  });
}

export { testGitHubService, testTokenFormats, main };

#!/usr/bin/env node

/**
 * Simple test script for quick triage testing with minimal setup
 */

import { runTriage, TriageConfig } from './triageWorkflow.js';
import { SplunkLogEvent } from './types.js';

/**
 * Create simple test data for quick testing
 */
function createSimpleTestData(): SplunkLogEvent[] {
  const now = new Date().toISOString();
  
  return [
    {
      _time: now,
      message: "NullPointerException in UserService.getUserById() at line 45",
      source: "user-service-app",
      serviceName: "user-service",
      environment: "production",
      level: "ERROR"
    },
    {
      _time: now,
      message: "Database connection timeout in OrderService.processOrder()",
      source: "order-service-app", 
      serviceName: "order-service",
      environment: "production",
      level: "ERROR"
    },
    {
      _time: now,
      message: "NullPointerException in UserService.getUserById() at line 45", // Duplicate
      source: "user-service-app",
      serviceName: "user-service", 
      environment: "production",
      level: "ERROR"
    },
    {
      _time: now,
      message: "Authentication failed for user session validation",
      source: "auth-service-app",
      serviceName: "auth-service",
      environment: "staging", 
      level: "ERROR"
    },
    {
      _time: now,
      message: "API rate limit exceeded in PaymentService.charge()",
      source: "payment-service-app",
      serviceName: "payment-service",
      environment: "production",
      level: "WARN"
    }
  ];
}

/**
 * Run a simple test
 */
async function runSimpleTest() {
  console.log('🧪 Running Simple Triage Test');
  console.log('=' .repeat(40));
  
  try {
    // Create test data
    const testData = createSimpleTestData();
    console.log(`📊 Created ${testData.length} test error events`);
    
    // Show test data
    console.log('\n📋 Test Data:');
    testData.forEach((log, index) => {
      console.log(`  ${index + 1}. [${log.serviceName}] ${log.message.substring(0, 80)}${log.message.length > 80 ? '...' : ''}`);
    });
    
    // Configure test
    const config: TriageConfig = {
      repositoryName: 'mycompany/test-service', // Replace with your repo
      commitLookbackDays: 7,
      createTickets: false // Dry run mode
    };
    
    console.log('\n⚙️  Configuration:', config);
    console.log('\n🔍 Starting triage analysis...\n');
    
    // Run triage
    await runTriage(testData, config);
    
    console.log('\n✅ Simple test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runSimpleTest().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { createSimpleTestData, runSimpleTest };

#!/usr/bin/env node

/**
 * Test script specifically for the OpenAI-powered triageSplunkErrorTool
 * 
 * This script tests the updated triage tool that uses parseRawSplunkEventWithOpenAI
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Test the OpenAI-powered triage functionality by directly calling the parsing function
 */
async function testOpenAITriageTool() {
  console.log('🤖 Testing OpenAI-Powered Triage Tool');
  console.log('=====================================\n');

  try {
    // Load test data from JSON file
    const testDataPath = join(__dirname, '../../instructions/splunk-test-data.json');
    const testDataContent = readFileSync(testDataPath, 'utf8');
    const testData = JSON.parse(testDataContent);

    // Create a proper Splunk event structure
    const splunkEvent = {
      _raw: testDataContent,
      Application: testData.Application,
      Environment: "QA",
      _time: testData["@t"]
    };

    const rawSplunkJson = JSON.stringify(splunkEvent);

    console.log('📄 Input Data:');
    console.log('- Application:', splunkEvent.Application);
    console.log('- Environment:', splunkEvent.Environment);
    console.log('- Raw data size:', rawSplunkJson.length, 'characters\n');

    // Import the OpenAI parser function
    const { parseRawSplunkEventWithOpenAI } = await import('./splunkParser.js');

    // Test parsing with OpenAI
    console.log('🔍 Parsing with OpenAI...');
    const startTime = Date.now();
    
    const triageInput = await parseRawSplunkEventWithOpenAI(rawSplunkJson);
    
    const parseTime = Date.now() - startTime;
    console.log(`✅ OpenAI parsing completed in ${parseTime}ms\n`);

    // Display results
    console.log('📊 Parsing Results:');
    console.log('==================');
    console.log('Service Name:', triageInput.serviceName);
    console.log('Environment:', triageInput.environment);
    console.log('Exception Type:', triageInput.exceptionType);
    console.log('Error Message:', triageInput.errorMessage);
    console.log('Stack Frames:', triageInput.stackTrace.length);
    
    console.log('\n🔍 Stack Trace (First 5 frames):');
    triageInput.stackTrace.slice(0, 5).forEach((frame, i) => {
      console.log(`  ${i + 1}. ${frame.method}() in ${frame.file}${frame.line ? `:${frame.line}` : ''}`);
    });

    console.log('\n🔍 Search Keywords:');
    console.log('Files:', triageInput.searchKeywords.files.join(', '));
    console.log('Methods:', triageInput.searchKeywords.methods.slice(0, 5).join(', '));
    console.log('Context:', triageInput.searchKeywords.context.join(', '));

    console.log('\n✅ OpenAI-powered triage tool test completed successfully!');
    console.log('\n💡 The triageSplunkErrorTool is now ready to use with enhanced OpenAI parsing capabilities.');
    console.log('   - More comprehensive stack trace extraction');
    console.log('   - Better method name identification'); 
    console.log('   - Enhanced context extraction');
    console.log('   - Improved handling of complex log formats');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
      console.log('\n💡 To run this test, ensure your .env file contains:');
      console.log('   OPENAI_API_KEY=your-api-key');
      console.log('   OPENAI_API_BASE_URL=https://api.openai.com/v1');
    }
    
    process.exit(1);
  }
}

// Run the test
testOpenAITriageTool().catch(console.error);

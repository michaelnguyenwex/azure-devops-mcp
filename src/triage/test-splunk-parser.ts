import { parseRawSplunkEvent } from './splunkParser.js';
import { RawSplunkEvent } from './types.js';
import fs from 'fs';
import path from 'path';

/**
 * Test script to validate the Splunk parser implementation
 * using sample data from splunk-test-data.json
 */
async function testSplunkParser() {
  console.log('Starting Splunk Parser Test...\n');

  try {
    // Load test data
    const testDataPath = path.join(process.cwd(), 'instructions', 'splunk-test-data.json');
    const testDataRaw = fs.readFileSync(testDataPath, 'utf-8');
    const testData = JSON.parse(testDataRaw);

    if (!Array.isArray(testData) || testData.length === 0) {
      throw new Error('Test data should be a non-empty array');
    }

    console.log(`Loaded ${testData.length} test events from splunk-test-data.json`);

    // Take the first event for testing
    const firstEvent = testData[0];
    console.log('Testing with first event...\n');

    // Prepare the raw event
    const rawEvent: RawSplunkEvent = {
      _raw: firstEvent._raw,
      Application: firstEvent.Application,
      Environment: firstEvent.Environment,
      _time: firstEvent._time
    };

    // Parse the event
    console.log('Parsing raw event...');
    const parsedResult = await parseRawSplunkEvent(rawEvent);

    // Display results
    console.log('\n=== PARSED RESULT ===');
    console.log(JSON.stringify(parsedResult, null, 2));

    // Expected output for comparison (from the instructions)
    const expectedOutput = {
      "serviceName": "WexHealth.CDH.Web.Consumer",
      "environment": "QA",
      "timestamp": "2025-10-16T14:13:57.833Z",
      "errorMessage": "Object reference not set to an instance of an object.",
      "exceptionType": "WEXHealth.Enterprise.DocumentIndex.SDK.DocumentIndexApiException",
      "stackTrace": [
        {
          "file": "SdkApiClient.cs",
          "method": "ReadAsJsonAsync",
          "line": null
        },
        {
          "file": "ApiClient.cs",
          "method": "GetJsonAsync",
          "line": null
        },
        {
          "file": "DocumentIndexApi.cs",
          "method": "GetShareableUrlAsync",
          "line": null
        },
        {
          "file": "SdkApiClient.cs",
          "method": "GetShareableUrl",
          "line": 173
        },
        {
          "file": "DocumentIndexProvider.cs",
          "method": "GetShareableUrl",
          "line": 299
        }
      ],
      "searchKeywords": {
        "files": [
          "SdkApiClient.cs",
          "DocumentIndexProvider.cs",
          "ApiClient.cs",
          "DocumentIndexApi.cs"
        ],
        "methods": [
          "GetShareableUrl",
          "GetShareableUrlAsync",
          "ReadAsJsonAsync",
          "GetJsonAsync"
        ],
        "context": [
          "DocumentIndexApiException",
          "DocumentIndexProvider",
          "DocumentIndexService"
        ]
      }
    };

    console.log('\n=== EXPECTED OUTPUT ===');
    console.log(JSON.stringify(expectedOutput, null, 2));

    // Simple validation
    console.log('\n=== VALIDATION RESULTS ===');
    
    const validations = [
      { name: 'Service Name', actual: parsedResult.serviceName, expected: expectedOutput.serviceName },
      { name: 'Environment', actual: parsedResult.environment, expected: expectedOutput.environment },
      { name: 'Error Message', actual: parsedResult.errorMessage, expected: expectedOutput.errorMessage },
      { name: 'Exception Type', actual: parsedResult.exceptionType, expected: expectedOutput.exceptionType },
      { name: 'Stack Trace Count', actual: parsedResult.stackTrace.length, expected: expectedOutput.stackTrace.length }
    ];

    let passedCount = 0;
    for (const validation of validations) {
      const passed = validation.actual === validation.expected;
      console.log(`${passed ? '✅' : '❌'} ${validation.name}: ${passed ? 'PASS' : 'FAIL'}`);
      if (!passed) {
        console.log(`   Expected: ${validation.expected}`);
        console.log(`   Actual:   ${validation.actual}`);
      }
      if (passed) passedCount++;
    }

    // Check if stack trace contains expected files
    const expectedFiles = new Set(expectedOutput.searchKeywords.files);
    const actualFiles = new Set(parsedResult.searchKeywords.files);
    const filesMatch = [...expectedFiles].every(f => actualFiles.has(f));
    console.log(`${filesMatch ? '✅' : '❌'} Search Keywords Files: ${filesMatch ? 'PASS' : 'FAIL'}`);
    if (filesMatch) passedCount++;

    // Check if methods match
    const expectedMethods = new Set(expectedOutput.searchKeywords.methods);
    const actualMethods = new Set(parsedResult.searchKeywords.methods);
    const methodsMatch = [...expectedMethods].every(m => actualMethods.has(m));
    console.log(`${methodsMatch ? '✅' : '❌'} Search Keywords Methods: ${methodsMatch ? 'PASS' : 'FAIL'}`);
    if (methodsMatch) passedCount++;

    console.log(`\n=== SUMMARY ===`);
    console.log(`Passed: ${passedCount}/${validations.length + 2} tests`);
    
    if (passedCount === validations.length + 2) {
      console.log('🎉 All tests passed! The parser is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please review the implementation.');
    }

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSplunkParser().catch(console.error);
}

export { testSplunkParser };

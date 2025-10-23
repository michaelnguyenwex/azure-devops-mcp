import { parseRawSplunkEventWithOpenAI } from '../splunkParser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

/**
 * Test script to validate the Splunk parser implementation
 * using sample data from src/triage/tests/splunk-test-data-err-text.json
 */
async function testSplunkParserFromErrText() {
  console.log('Starting Splunk Parser Test from splunk-test-data-err-text.json...\n');

  try {
    // Load test data
    const testDataPath = path.join(process.cwd(), 'src', 'triage', 'tests', 'splunk-test-data-err-text.json');
    const errorText = fs.readFileSync(testDataPath, 'utf-8');
    console.log('Loaded test data from splunk-test-data-err-text.json');

    // Construct a mock Splunk event
    const rawContent = {
      '@t': new Date().toISOString(),
      '@mt': "An unhandled exception has occurred while executing the request.",
      '@x': errorText,
      SourceContext: "Microsoft.AspNetCore.Hosting.Diagnostics",
      RequestId: "mock-request-id",
    };

    const mockSplunkEvent = {
      _time: new Date().toISOString(),
      _raw: JSON.stringify(rawContent),
      sourcetype: 'iis',
      source: 'mock',
      host: 'mock',
      index: 'mock',
      Application: "WexHealth.CDH.Web.Participant",
      Environment: "PROD",
    };
    
    const rawEventJson = JSON.stringify(mockSplunkEvent);

    // Parse the event
    console.log('Parsing raw event with OpenAI...');
    const parsedResult = await parseRawSplunkEventWithOpenAI(rawEventJson);

    // Display results
    console.log('\n=== PARSED RESULT ===');
    console.log(JSON.stringify(parsedResult, null, 2));

    // Expected output
    const expectedOutput = {
      "serviceName": "WexHealth.CDH.Web.Participant",
      "environment": "PROD",
      "timestamp": mockSplunkEvent._time,
      "errorMessage": "Unable to cast to targetType ContentContainer: There is an error in XML document (1, 527).",
      "exceptionType": "System.Web.HttpUnhandledException",
      "stackTrace": [
        { "file": "SerializationHelper.cs", "method": "Deserialize", "line": 98 },
        { "file": "SerializationHelper.cs", "method": "Deserialize", "line": 102 },
        { "file": "SerializationHelper.cs", "method": "Deserialize", "line": 65 },
        { "file": "SerializationHelper.cs", "method": "Deserialize", "line": 42 },
        { "file": "CustomContentRepository.cs", "method": "GetCustomContentTree", "line": 469 },
        { "file": "HomePresenter.cs", "method": "get_ContentTree", "line": 70 },
        { "file": "HomePresenter.cs", "method": "InitCustomSection", "line": 149 },
        { "file": "HomePresenter.cs", "method": "InternalInitView", "line": 79 },
        { "file": "ViewPresenterBase.cs", "method": "InitView", "line": 64 },
        { "file": "Main.aspx.cs", "method": "LoadEvent", "line": 69 },
        { "file": "PageBase.cs", "method": "Page_Load", "line": 225 }
      ],
      "searchKeywords": {
        "files": [
          "SerializationHelper.cs",
          "CustomContentRepository.cs",
          "HomePresenter.cs",
          "ViewPresenterBase.cs",
          "Main.aspx.cs",
          "PageBase.cs"
        ],
        "methods": [
          "Deserialize",
          "GetCustomContentTree",
          "get_ContentTree",
          "InitCustomSection",
          "InternalInitView",
          "InitView",
          "LoadEvent",
          "Page_Load"
        ],
        "context": [
          "HttpUnhandledException",
          "SerializationHelper",
          "CustomContentRepository",
          "HomePresenter"
        ]
      }
    };
    
    console.log('\n=== EXPECTED OUTPUT ===');
    console.log(JSON.stringify(expectedOutput, null, 2));

    // Validation
    console.log('\n=== VALIDATION RESULTS ===');
    
    let passedCount = 0;
    const validations = [
        { name: 'Service Name', actual: parsedResult.serviceName, expected: expectedOutput.serviceName },
        { name: 'Environment', actual: parsedResult.environment, expected: expectedOutput.environment },
        { name: 'Error Message', actual: parsedResult.errorMessage, expected: expectedOutput.errorMessage },
        { name: 'Exception Type', actual: parsedResult.exceptionType, expected: expectedOutput.exceptionType },
    ];

    for (const validation of validations) {
        const passed = validation.actual === validation.expected;
        console.log(`${passed ? '✅' : '❌'} ${validation.name}: ${passed ? 'PASS' : 'FAIL'}`);
        if (!passed) {
            console.log(`   Expected: ${validation.expected}`);
            console.log(`   Actual:   ${validation.actual}`);
        }
        if (passed) passedCount++;
    }

    const actualStackTraceSimple = new Set(parsedResult.stackTrace.map(st => `${st.file}:${st.line}`));
    const expectedStackTraceSimple = new Set(expectedOutput.stackTrace.map(st => `${st.file}:${st.line}`));
    const stackTraceMatch = [...expectedStackTraceSimple].every(st => actualStackTraceSimple.has(st));
    console.log(`${stackTraceMatch ? '✅' : '❌'} Stack Trace content: ${stackTraceMatch ? 'PASS' : 'FAIL'}`);
    if (stackTraceMatch) passedCount++;
    
    const expectedFiles = new Set(expectedOutput.searchKeywords.files);
    const actualFiles = new Set(parsedResult.searchKeywords.files);
    const filesMatch = [...expectedFiles].every(f => actualFiles.has(f));
    console.log(`${filesMatch ? '✅' : '❌'} Search Keywords Files: ${filesMatch ? 'PASS' : 'FAIL'}`);
    if (filesMatch) passedCount++;

    const expectedMethods = new Set(expectedOutput.searchKeywords.methods);
    const actualMethods = new Set(parsedResult.searchKeywords.methods);
    const methodsMatch = [...expectedMethods].every(m => actualMethods.has(m));
    console.log(`${methodsMatch ? '✅' : '❌'} Search Keywords Methods: ${methodsMatch ? 'PASS' : 'FAIL'}`);
    if (methodsMatch) passedCount++;

    console.log(`\n=== SUMMARY ===`);
    const totalTests = validations.length + 3;
    console.log(`Passed: ${passedCount}/${totalTests} tests`);

    if (passedCount === totalTests) {
        console.log('🎉 All tests passed! The parser is working correctly for the given error text.');
    } else {
        console.log('⚠️  Some tests failed. Please review the implementation.');
    }

  } catch (error) {
    console.error('Test failed:', error);
    if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
      console.log('\n💡 To run this test, ensure your .env file in the project root contains:');
      console.log('   OPENAI_API_KEY=your-api-key');
      console.log('   OPENAI_API_BASE_URL=https://api.openai.com/v1');
    }
    process.exit(1);
  }
}

// Run the test if this file is executed directly
const __filename = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1]) === __filename) {
  testSplunkParserFromErrText().catch(console.error);
}

export { testSplunkParserFromErrText };

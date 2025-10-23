import 'dotenv/config';
import { parseRawSplunkEvent, parseRawSplunkEventWithOpenAI } from '../splunkParser.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Test script to compare the original regex-based parser with the new OpenAI-based parser
 */
async function testSplunkParsers() {
  console.log('🧪 Testing Splunk Parsers: Regex vs OpenAI\n');

  try {
    // Load the test data from the JSON file
    const testDataPath = join(__dirname, '../../instructions/splunk-test-data.json');
    const testDataContent = readFileSync(testDataPath, 'utf8');
    const testData = JSON.parse(testDataContent);

    // Create a proper Splunk event structure
    // The test data is the _raw content, so we need to wrap it in a Splunk event
    const splunkEvent = {
      _raw: testDataContent, // The entire test data as a JSON string
      Application: testData.Application,
      Environment: "QA", // Adding a test environment since it's not in the test data
      _time: testData["@t"] // Using the timestamp from the test data
    };

    const rawSplunkJson = JSON.stringify(splunkEvent);

    console.log('📄 Input Splunk Event:');
    console.log('Application:', splunkEvent.Application);
    console.log('Environment:', splunkEvent.Environment);
    console.log('Timestamp:', splunkEvent._time);
    console.log('Raw data length:', splunkEvent._raw.length, 'characters\n');

    // Test the original regex-based parser
    console.log('🔍 Testing Regex-based Parser...');
    const regexStartTime = Date.now();
    let regexResult;
    try {
      regexResult = await parseRawSplunkEvent(rawSplunkJson);
      const regexEndTime = Date.now();
      console.log('✅ Regex parser completed in', regexEndTime - regexStartTime, 'ms');
      console.log('📊 Regex Results:');
      console.log('- Service:', regexResult.serviceName);
      console.log('- Environment:', regexResult.environment);
      console.log('- Exception Type:', regexResult.exceptionType);
      console.log('- Error Message:', regexResult.errorMessage);
      console.log('- Stack Trace Frames:', regexResult.stackTrace.length);
      console.log('- Search Keywords - Files:', regexResult.searchKeywords.files.length);
      console.log('- Search Keywords - Methods:', regexResult.searchKeywords.methods.length);
      console.log('- Search Keywords - Context:', regexResult.searchKeywords.context.length);
      console.log();
    } catch (error) {
      console.log('❌ Regex parser failed:', error instanceof Error ? error.message : 'Unknown error');
      console.log();
    }

    // Test the OpenAI-based parser
    console.log('🤖 Testing OpenAI-based Parser...');
    const openAIStartTime = Date.now();
    let openAIResult;
    try {
      openAIResult = await parseRawSplunkEventWithOpenAI(rawSplunkJson);
      const openAIEndTime = Date.now();
      console.log('✅ OpenAI parser completed in', openAIEndTime - openAIStartTime, 'ms');
      console.log('📊 OpenAI Results:');
      console.log('- Service:', openAIResult.serviceName);
      console.log('- Environment:', openAIResult.environment);
      console.log('- Exception Type:', openAIResult.exceptionType);
      console.log('- Error Message:', openAIResult.errorMessage);
      console.log('- Stack Trace Frames:', openAIResult.stackTrace.length);
      console.log('- Search Keywords - Files:', openAIResult.searchKeywords.files.length);
      console.log('- Search Keywords - Methods:', openAIResult.searchKeywords.methods.length);
      console.log('- Search Keywords - Context:', openAIResult.searchKeywords.context.length);
      
      console.log('\n📄 Complete OpenAI JSON Output:');
      console.log('=' .repeat(60));
      console.log(JSON.stringify(openAIResult, null, 2));
      console.log('=' .repeat(60));
      console.log();
    } catch (error) {
      console.log('❌ OpenAI parser failed:', error instanceof Error ? error.message : 'Unknown error');
      if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
        console.log('💡 To test the OpenAI parser, create a .env file in the root directory with:');
        console.log('   OPENAI_API_KEY=your-openai-api-key');
        console.log('   OPENAI_API_BASE_URL=https://api.openai.com/v1');
      }
      console.log();
    }

    // Compare results if both succeeded
    if (regexResult && openAIResult) {
      console.log('🔄 Comparison Results:');
      console.log('='.repeat(50));
      
      console.log('\n📍 Basic Fields:');
      console.log('Service Name Match:', regexResult.serviceName === openAIResult.serviceName ? '✅' : '❌', 
                  `(Regex: "${regexResult.serviceName}", OpenAI: "${openAIResult.serviceName}")`);
      console.log('Environment Match:', regexResult.environment === openAIResult.environment ? '✅' : '❌', 
                  `(Regex: "${regexResult.environment}", OpenAI: "${openAIResult.environment}")`);
      console.log('Exception Type Match:', regexResult.exceptionType === openAIResult.exceptionType ? '✅' : '❌', 
                  `(Regex: "${regexResult.exceptionType}", OpenAI: "${openAIResult.exceptionType}")`);
      console.log('Error Message Match:', regexResult.errorMessage === openAIResult.errorMessage ? '✅' : '❌');
      if (regexResult.errorMessage !== openAIResult.errorMessage) {
        console.log('  Regex:', regexResult.errorMessage);
        console.log('  OpenAI:', openAIResult.errorMessage);
      }

      console.log('\n🔗 Stack Trace Analysis:');
      console.log('Frame Count - Regex:', regexResult.stackTrace.length, '| OpenAI:', openAIResult.stackTrace.length);
      
      if (regexResult.stackTrace.length > 0) {
        console.log('\nRegex Stack Frames:');
        regexResult.stackTrace.forEach((frame, i) => {
          console.log(`  ${i + 1}. ${frame.file} -> ${frame.method}() ${frame.line ? `:${frame.line}` : ''}`);
        });
      }

      if (openAIResult.stackTrace.length > 0) {
        console.log('\nOpenAI Stack Frames:');
        openAIResult.stackTrace.forEach((frame, i) => {
          console.log(`  ${i + 1}. ${frame.file} -> ${frame.method}() ${frame.line ? `:${frame.line}` : ''}`);
        });
      }

      console.log('\n🔍 Search Keywords Comparison:');
      console.log('Files - Regex:', regexResult.searchKeywords.files.join(', '));
      console.log('Files - OpenAI:', openAIResult.searchKeywords.files.join(', '));
      console.log('Methods - Regex:', regexResult.searchKeywords.methods.join(', '));
      console.log('Methods - OpenAI:', openAIResult.searchKeywords.methods.join(', '));
      console.log('Context - Regex:', regexResult.searchKeywords.context.join(', '));
      console.log('Context - OpenAI:', openAIResult.searchKeywords.context.join(', '));
    }

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('💥 Test failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the test
testSplunkParsers().catch(console.error);

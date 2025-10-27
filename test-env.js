// Simple script to test if .env file exists and can be loaded
import dotenv from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

console.log('\n=== Environment Variable Test ===\n');

const envPath = resolve(process.cwd(), '.env');
console.log('Current directory:', process.cwd());
console.log('.env path:', envPath);
console.log('.env file exists:', existsSync(envPath) ? '✅ YES' : '❌ NO');

if (existsSync(envPath)) {
  console.log('\nLoading .env file...');
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.error('❌ Error:', result.error.message);
  } else {
    console.log('✅ Loaded successfully\n');
    console.log('Environment variables:');
    console.log('  SPLUNK_HOST:', process.env.SPLUNK_HOST || 'NOT SET');
    console.log('  SPLUNK_PORT:', process.env.SPLUNK_PORT || 'NOT SET');
    console.log('  SPLUNK_TOKEN:', process.env.SPLUNK_TOKEN ? '***' + process.env.SPLUNK_TOKEN.slice(-4) : 'NOT SET');
    console.log('  SPLUNK_SCHEME:', process.env.SPLUNK_SCHEME || 'NOT SET');
    console.log('  SPLUNK_VERIFY_SSL:', process.env.SPLUNK_VERIFY_SSL || 'NOT SET');
    console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '***' + process.env.OPENAI_API_KEY.slice(-4) : 'NOT SET');
    console.log('  OPENAI_API_BASE_URL:', process.env.OPENAI_API_BASE_URL || 'NOT SET');
  }
} else {
  console.log('\n⚠️  .env file not found!');
  console.log('Please create a .env file in the project root with:');
  console.log(`
SPLUNK_HOST=your-splunk-host.com
SPLUNK_PORT=8089
SPLUNK_TOKEN=your-token-here
SPLUNK_SCHEME=https
SPLUNK_VERIFY_SSL=false

OPENAI_API_KEY=your-openai-key
OPENAI_API_BASE_URL=https://api.openai.com/v1
  `);
}

console.log('\n');


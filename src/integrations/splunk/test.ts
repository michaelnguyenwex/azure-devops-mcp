import { SplunkClient } from './client.js';
import 'dotenv/config';

async function test() {
  const client = new SplunkClient({
    host: process.env.SPLUNK_HOST || 'your-host',
    port: parseInt(process.env.SPLUNK_PORT || '8089'),
    scheme: (process.env.SPLUNK_SCHEME || 'https') as 'http' | 'https',
    token: process.env.SPLUNK_TOKEN || 'your-token',
    verifySsl: process.env.SPLUNK_VERIFY_SSL === 'true'
  });

  try {
    console.log('Testing search...');
    const results = await client.search.execute(
      'index=_internal | head 5',
      { earliestTime: '-1h', latestTime: 'now', maxResults: 5 }
    );
    console.log('✅ Search works!', results.results.length, 'results');

    console.log('\nTesting saved searches...');
    const saved = await client.savedSearches.list();
    console.log('✅ Saved searches works!', saved.length, 'searches');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

test();


# Splunk Natural Language Search Tool Tests

This directory contains tests for the AI-powered natural language Splunk search tool.

## Test File: `test-search-natural-language.ts`

Comprehensive test suite for the `search_splunk` tool that converts natural language queries to SPL and executes them against Splunk.

### Prerequisites

1. **Environment Variables** - Create a `.env` file in the project root with:
   ```env
   # Splunk Configuration
   SPLUNK_HOST=your-splunk-host.com
   SPLUNK_PORT=8089
   SPLUNK_TOKEN=your-splunk-token
   SPLUNK_SCHEME=https
   SPLUNK_VERIFY_SSL=false
   
   # OpenAI Configuration
   OPENAI_API_KEY=your-openai-api-key
   OPENAI_API_BASE_URL=https://api.openai.com/v1
   ```

2. **Splunk Instance** - Access to a running Splunk instance with the `applogs` index

3. **Node.js** - Node.js 18+ with TypeScript support

### Running the Tests

```bash
# Run all tests
npx tsx src/integrations/splunk/tools/tests/test-search-natural-language.ts

# Or if you have built the project
node build/integrations/splunk/tools/tests/test-search-natural-language.js
```

### Test Coverage

The test suite includes three main test groups:

#### 1. Query Generation Tests
Tests the natural language to SPL conversion without executing Splunk queries.

**Test Cases:**
- ✅ Simple error search for Consumer Portal in Production
- ✅ CIP errors in last hour
- ✅ Auth service exceptions in QA
- ✅ Count errors by application
- ✅ Admin Portal errors over time
- ✅ Data API recent logs
- ✅ NESW exceptions with details
- ✅ Employer Portal table output

**What it tests:**
- Friendly name mapping (e.g., "cip" → "WexHealth.CDH.ConsumerInvestment.Portal")
- Environment mapping (e.g., "prod" → "PROD")
- SPL query generation
- Expected patterns in generated queries

#### 2. Edge Case Tests
Tests unusual or challenging queries to verify robustness.

**Test Cases:**
- Vague queries ("show me stuff")
- Queries with typos
- Complex multi-condition queries

#### 3. Full Search Execution Test
Tests the complete workflow including Splunk connection and result retrieval.

**What it tests:**
- SPL generation
- Splunk client initialization
- Search job creation
- Result fetching with pagination
- Result formatting

### Expected Output

```
╔════════════════════════════════════════════════════════╗
║  Natural Language Splunk Search Tool - Test Suite     ║
╚════════════════════════════════════════════════════════╝

🧪 ============================================
   Testing Natural Language to SPL Generation
   ============================================

📝 Test 1/8: Simple error search for Consumer Portal in Production
   Natural Language: "show me errors for the consumer portal in prod"
   ✅ Generated SPL (1234ms):
      index=applogs Application=WexHealth.CDH.Web.Consumer Environment=PROD (@l=Error OR @l=Fatal)
   ✓ All expected patterns found

...

📊 Query Generation Summary:
   Passed: 8/8
   Failed: 0/8

...

✨ All tests completed!
```

### Troubleshooting

**OpenAI API Errors:**
- Verify `OPENAI_API_KEY` is set correctly
- Check `OPENAI_API_BASE_URL` points to the correct endpoint
- Ensure you have credits/quota available

**Splunk Connection Errors:**
- Verify `SPLUNK_HOST` and `SPLUNK_TOKEN` are correct
- Check network connectivity to Splunk instance
- Verify SSL settings match your Splunk configuration

**No Results Found:**
- This is normal if there are no logs in the specified time range
- Try increasing the time range (e.g., "-24h" instead of "-5m")
- Verify the application/index exists in your Splunk instance

### Customizing Tests

You can add your own test cases by editing the `testCases` array:

```typescript
{
  name: "My custom test",
  naturalLanguageQuery: "show me warnings in my app",
  expectedPatterns: ["index=applogs", "Warning", "MyApp"],
  earliestTime: "-1h",
  latestTime: "now"
}
```

### Integration with CI/CD

To run only query generation tests (no Splunk connection required):

```bash
# Modify the test file to skip full execution test
# Or create a separate npm script:
npm test:query-generation
```

For full integration tests in CI/CD, ensure Splunk credentials are available as secrets/environment variables.


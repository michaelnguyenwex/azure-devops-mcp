# DevOps Tests

Test scripts for the DevOps story creation functionality.

## Setup

Before running tests, ensure all required environment variables are set. You can either:

### Option 1: Use a .env file (Recommended)

Create a `.env` file in the root directory of the project:

```bash
# Azure DevOps
AZDO_ORG=WexHealthTech
AZDO_PROJECT=Health
AZDO_PAT=your-azure-devops-pat

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_API_BASE_URL=https://api.openai.com/v1

# GitHub
GITHUB_TOKEN=your-github-token
# OR use GITHUB_PAT instead
```

### Option 2: Export environment variables

```bash
# Azure DevOps
export AZDO_ORG="WexHealthTech"
export AZDO_PROJECT="Health"
export AZDO_PAT="your-azure-devops-pat"

# OpenAI
export OPENAI_API_KEY="your-openai-api-key"
export OPENAI_API_BASE_URL="https://api.openai.com/v1"

# GitHub
export GITHUB_TOKEN="your-github-token"
# OR
export GITHUB_PAT="your-github-token"
```

## Running Tests

### Test CreateDevOpsStory

Tests the main `createDevOpsStory` function with various scenarios:

```bash
# Build the project first
npm run build

# Run the test
node build/devops/tests/test-create-devops.js
```

### Test Cases Included

1. **Remove Feature Flag**: Tests removing a feature flag story creation
   - Sample input: `"remove ff https://github.com/wexinc/health-cdh-investment-api/pull/757"`

### Adding More Test Cases

Edit `src/devops/tests/test-create-devops.ts` and add more test cases to the `testCases` array:

```typescript
const testCases = [
  {
    name: 'Remove Feature Flag',
    input: 'remove ff https://github.com/wexinc/health-cdh-investment-api/pull/757'
  },
  {
    name: 'Create Feature Flag',
    input: 'create ff https://github.com/WEXHealthTech/health-cdh-authservice/pull/123'
  },
  {
    name: 'Run Pipeline',
    input: 'run pipeline https://github.com/WEXHealthTech/health-cdh-authservice/pull/789'
  }
];
```

## Expected Output

Successful test run will show:

```
================================================================================
Testing createDevOpsStory Function
================================================================================

📋 Checking environment variables...
✅ All required environment variables are set
   - AZDO_ORG: WexHealthTech
   - AZDO_PROJECT: Health
   ...

================================================================================
🧪 Test Case: Remove Feature Flag
================================================================================
📝 Input: "remove ff https://github.com/wexinc/health-cdh-investment-api/pull/757"

🚀 Starting DevOps story creation...
...

✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅
✅ TEST PASSED
✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅

📊 Result Summary:
   - Work Item ID: 12345
   - Work Item Type: User Story
   - Title: [Month] Remove FFName FF
   ...
```

## Troubleshooting

### Error: "Missing required environment variables"

Make sure all environment variables are set. You can either:

1. **Create a `.env` file** (recommended) in the project root with all required variables
2. **Export variables** in your shell

To check if variables are loaded:

```bash
echo $AZDO_PAT
echo $GITHUB_TOKEN
echo $OPENAI_API_KEY
```

**Note**: The test script uses `dotenv` to automatically load variables from a `.env` file in the root directory.

### Error: "Feature flag name not found in PR"

The PR may not contain recognizable feature flag information. Check that the PR description contains text like:
- "Feature Flag 1: CDH500-EnableNewUI"
- "Feature Flag: YOUR_FLAG_NAME"

### Error: "Pipeline not found"

The pipeline name doesn't match any pipelines in Azure DevOps. Verify:
- The pipeline exists in Azure DevOps
- The pipeline naming convention is correct (usually `app-name-api-az-cd`)

### Error: "Azure DevOps authentication failed"

Check that:
- `AZDO_PAT` environment variable is set correctly
- The PAT token has not expired
- The PAT has Work Items (Read & Write) permissions


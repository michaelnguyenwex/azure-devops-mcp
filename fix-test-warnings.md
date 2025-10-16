# Fix Test Warnings Guide

The warnings you see during testing are **expected behaviors** for graceful degradation when optional services aren't configured. Here's how to fix them if you want full functionality:

## ⚠️ Warning 1: GitHub Token Not Configured

```
⚠️  No GitHub token configured. Returning empty commits list for [repo-name]
```

### What this means:
- The triage system can't fetch commits for root cause analysis
- System continues to work but without commit-based insights
- **This is expected in test environments**

### To Fix (Optional):

#### Quick Fix:
```bash
# Windows PowerShell
$env:GITHUB_TOKEN = "ghp_your_token_here"

# Then run test again
npm run test:triage-simple
```

#### Permanent Fix:
1. Create GitHub Personal Access Token:
   - Go to GitHub.com → Settings → Developer settings → Personal access tokens
   - Generate new token with `repo` scope (for private repos) or `public_repo` (for public repos)

2. Set environment variable:
   ```bash
   # Add to your .env file
   GITHUB_TOKEN=ghp_your_token_here
   ```

3. Verify:
   ```bash
   npm run test:triage-simple
   ```
   
   You should see:
   ```
   ✅ Retrieved X commits from GitHub
   ✅ Identified X suspected commits
   ```

## ⚠️ Warning 2: Splunk Not Configured

```
⚠️  Splunk not configured - using placeholder URL (set SPLUNK_URL to enable real Splunk links)
```

### What this means:
- The system can't generate real Splunk search URLs
- Uses placeholder URLs instead: `https://your-splunk.com/en-US/app/search/search`
- **This is expected in test environments**

### To Fix (Optional):

#### If you have Splunk access:
```bash
# Set environment variables
SPLUNK_URL=https://your-splunk-instance.com:8089
SPLUNK_TOKEN=your_splunk_token_here

# Or in .env file
SPLUNK_URL=https://your-company.splunkcloud.com:8089
SPLUNK_TOKEN=your_token_here
VERIFY_SSL=false  # if using self-signed certificates
```

#### Test the fix:
```bash
npm run test:triage-simple
```

You should see:
```
✅ Built Splunk search link: https://your-splunk.com/en-US/app/search/search?q=...
```

## 🎯 Expected Test Behavior

### With NO configuration (normal test mode):
```
⚠️  GitHub token not found. Set GITHUB_TOKEN or GITHUB_PAT environment variable for GitHub integration.
⚠️  Splunk not configured - using placeholder URL (set SPLUNK_URL to enable real Splunk links)
Found 0 recent commits
Dry-run mode: would create ticket for this error
```
**✅ This is CORRECT and expected!**

### With FULL configuration:
```
✅ Retrieved 15 commits from GitHub
✅ Identified 3 suspected commits
✅ Built Splunk search link: https://your-splunk.com/en-US/app/search/search?q=...
✅ Created Jira ticket: PROD-123 (if createTickets: true)
```

## 🔧 Test Configuration Examples

### Minimal Test (Current - Works Great):
```bash
npm run test:triage-simple
# No setup needed - tests core functionality with graceful degradation
```

### Full Integration Test:
```bash
# Set environment variables
export GITHUB_TOKEN=ghp_your_token_here
export SPLUNK_URL=https://your-splunk.com:8089
export SPLUNK_TOKEN=your_token_here

# Run test
npm run test:triage-simple
```

### Production-Ready Test:
```bash
# Add to .env file
GITHUB_TOKEN=ghp_your_token_here
JIRA_PAT=your_base64_jira_token
JIRA_API_BASE_URL=https://your-company.atlassian.net
SPLUNK_URL=https://your-splunk.com:8089
SPLUNK_TOKEN=your_token_here

# Test with actual ticket creation
node -e "
const testModule = await import('./build/triage/test-simple.js');
const config = {
  repositoryName: 'your-company/your-repo',
  createTickets: true  // Actually create tickets!
};
await testModule.runSimpleTest(config);
"
```

## 🎉 Summary

**The warnings are GOOD!** They show the system is working correctly with graceful degradation. 

- **For testing**: No configuration needed - warnings are expected
- **For production**: Configure GitHub token and optionally Splunk for full functionality
- **System always works**: Missing services don't break the triage workflow

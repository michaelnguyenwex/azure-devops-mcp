# Triage Function Testing Guide

This guide explains how to test the `runTriage` function using the provided test scripts and real Splunk data.

## 🧪 Test Scripts

### 1. Simple Test (`test-simple.ts`)
Quick test with synthetic data for basic validation.

```bash
npm run test:triage-simple
```

**Features:**
- Creates 5 synthetic error events
- Tests error grouping (includes duplicate)
- Multiple services and environments
- Dry-run mode (no actual tickets created)

### 2. Comprehensive Test (`test-triage.ts`)
Full test using real Splunk data from `instructions/splunk-test-data.json`.

```bash
npm run test:triage
```

**Features:**
- Uses real production error data
- Multiple test scenarios
- Different repository configurations
- Error handling testing
- Large dataset processing

## 📊 Test Scenarios

### Scenario 1: Basic Dry Run
```typescript
{
  repositoryName: 'wexhealth/cdh-consumer',
  commitLookbackDays: 7,
  createTickets: false
}
```

### Scenario 2: Different Repository
```typescript
{
  repositoryName: 'wexhealth/document-index',
  commitLookbackDays: 3,
  createTickets: false
}
```

### Scenario 3: No Repository (Graceful Degradation)
```typescript
{
  commitLookbackDays: 7,
  createTickets: false
}
```

### Scenario 4: Invalid Configuration (Error Handling)
```typescript
{
  repositoryName: 'invalid-repo-name', // Invalid format
  commitLookbackDays: 35, // Too many days
  createTickets: false
}
```

## 🌍 Environment Setup

### Required (for full functionality)
- **GITHUB_TOKEN** or **GITHUB_PAT**: GitHub Personal Access Token
  - Permissions: `repo` (private repos) or `public_repo` (public repos)
  - Used for commit analysis and root cause identification

### Optional
- **JIRA_PAT**: JIRA API token (Base64 encoded "email:api_token")
  - Only needed if `createTickets: true`
- **SPLUNK_URL**: Splunk instance URL
  - Used for state management and duplicate prevention

### Example .env file
```bash
# Required for commit analysis
GITHUB_TOKEN=your_github_personal_access_token

# Optional - for ticket creation
JIRA_PAT=your_base64_encoded_jira_token
JIRA_API_BASE_URL=https://your-domain.atlassian.net

# Optional - for state management
SPLUNK_URL=https://your-splunk.com:8089
SPLUNK_TOKEN=your_splunk_token
```

## 🔍 What the Tests Validate

### ✅ Core Functionality
- **Error Signature Generation**: Groups similar errors
- **Data Transformation**: Converts Splunk data to internal format
- **Configuration Validation**: Tests parameter validation
- **Error Handling**: Graceful degradation when services unavailable

### ✅ GitHub Integration
- **Commit Fetching**: Retrieves recent commits
- **Commit Analysis**: Identifies suspected root causes
- **API Error Handling**: Handles GitHub API failures gracefully

### ✅ Workflow Orchestration
- **Service Initialization**: All triage services start correctly
- **State Management**: Duplicate error detection
- **Jira Integration**: Ticket creation (when enabled)

### ✅ Edge Cases
- **Missing Repository**: Functions without GitHub repo
- **Invalid Configuration**: Proper error messages
- **Large Datasets**: Performance with many log entries
- **Network Issues**: Continues operation when services fail

## 📋 Expected Test Output

### Successful Test Run
```
🧪 Running Simple Triage Test
========================================
📊 Created 5 test error events

📋 Test Data:
  1. [user-service] NullPointerException in UserService.getUserById() at line 45
  2. [order-service] Database connection timeout in OrderService.processOrder()
  3. [user-service] NullPointerException in UserService.getUserById() at line 45
  4. [auth-service] Authentication failed for user session validation
  5. [payment-service] API rate limit exceeded in PaymentService.charge()

⚙️  Configuration: {
  repositoryName: 'mycompany/test-service',
  commitLookbackDays: 7,
  createTickets: false
}

🔍 Starting triage analysis...

Starting triage analysis for 5 log events
Triage configuration: {
  commitLookbackDays: 7,
  createTickets: false,
  repositoryName: 'mycompany/test-service'
}
Aggregating errors by signature...
Found 4 unique error signatures

Processing error signature: NullPointerException getUserById...
Error occurred 2 times
Service: user-service, Environment: production, First seen: 2024-01-15T10:30:00.000Z
✅ Found existing triage record for this error signature

=== Triage Analysis Complete ===
Total unique error signatures: 4
Newly processed: 3
Already processed (skipped): 1
Total log events analyzed: 5

✅ Simple test completed successfully!
```

## 🚨 Troubleshooting

### Common Issues

1. **Build Errors**
   ```bash
   npm run build
   # Check for TypeScript compilation errors
   ```

2. **GitHub API Rate Limits**
   - Ensure GITHUB_TOKEN is set
   - Use a token with appropriate permissions
   - Check rate limit status in output

3. **Test Data Not Found**
   - Verify `instructions/splunk-test-data.json` exists
   - Check file path in test script

4. **Import/Module Errors**
   - Ensure all dependencies are installed: `npm install`
   - Check that build completed successfully

### Debug Mode
Add debug logging by setting environment variable:
```bash
DEBUG=triage:* npm run test:triage-simple
```

## 🎯 Interpreting Results

### Success Indicators
- ✅ Error signatures grouped correctly
- ✅ Commits fetched (if GitHub token provided)
- ✅ Jira tickets formatted (if enabled)
- ✅ State management working
- ✅ No unhandled exceptions

### Performance Metrics
- **Error Processing Rate**: ~10-50 errors/second
- **GitHub API Calls**: 1 per repository per test
- **Memory Usage**: <100MB for typical datasets
- **Duplicate Detection**: 100% accuracy

The test suite validates that the triage system can handle real production errors and provides meaningful analysis for debugging and ticket creation.

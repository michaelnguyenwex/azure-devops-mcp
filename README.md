# MCP-AZDO: Azure DevOps Tools for Model Context Protocol

`mcp-azdo` is a command-line tool that provides a set of utilities to interact with Azure DevOps services, designed to be used as a Model Context Protocol (MCP) server. It allows you to manage test cases, test suites, and other work items.

## Features

*   **Azure DevOps Integration:**
    *   Fetch work item details
    *   Create new test cases with detailed steps, priority, and assignments
    *   Optionally create child test suites under a parent plan/suite when creating test cases
    *   Update test cases with automation details
    *   Create or retrieve static test suites
    *   Add existing test cases to test suites
    *   Copy test cases between suites
*   **JIRA Integration:**
    *   Fetch JIRA issue details
    *   Link test cases to JIRA issues with automatic ADF formatting
    *   Create JIRA subtasks with predefined templates
    *   Bidirectional linking between Azure DevOps and JIRA
*   **Splunk Integration:**
    *   Execute Splunk search queries using SPL (Search Processing Language)
    *   Search through Splunk indexes for logs, metrics, and machine data
    *   Configurable time ranges and result limits
*   **GitHub Integration:**
    *   Automated error triage with GitHub commit analysis
    *   Retrieve recent commits to identify potential root causes
    *   Link Jira tickets to related GitHub pull requests and commits
*   **Automated Error Triage:**
    *   Analyze production errors from Splunk logs automatically
    *   Generate error signatures to group similar issues
    *   Cross-reference with GitHub commits to identify suspected root causes
    *   Create detailed Jira tickets with investigation starting points
    *   Prevent duplicate ticket creation through state management

## Prerequisites

Before using this tool, ensure you have Node.js and npm installed.

## Installation

### For End-Users (once published to npm)

```bash
npm install -g mcp-azdo
```
Then you can run the tool using `azdo-mcp` or via `npx`:
```bash
npx mcp-azdo
```

### For Developers (local setup)

1.  Clone the repository:
    ```bash
    git clone <your-repository-url>
    cd mcp-azdo
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build the project:
    ```bash
    npm run build
    ```
4.  Link the package for local development:
    ```bash
    npm link
    ```
    This will make the `azdo-mcp` command available globally, pointing to your local project.

## Configuration

This tool requires the following environment variables to be set to authenticate and interact with Azure DevOps, JIRA, Splunk, and GitHub:

### Required Variables

**Azure DevOps:**
*   `AZDO_ORG`: Your Azure DevOps organization name.
*   `AZDO_PROJECT`: Your Azure DevOps project name.
*   `AZDO_PAT`: Your Azure DevOps Personal Access Token. The PAT must have sufficient permissions (e.g., "Read & write" for Work Items and "Read & write" for Test Management).

**JIRA:**
*   `JIRA_PAT`: Your JIRA API key for authentication (Base64 encoded "email:api_token" string).
*   `JIRA_API_BASE_URL`: Your JIRA instance base URL (e.g., "https://your-domain.atlassian.net").

### Optional Variables

**Splunk (optional):**
*   `SPLUNK_URL`: Full Splunk URL (e.g., "https://your-splunk.com:8089") OR
*   `SPLUNK_HOST`: Splunk hostname (e.g., "your-splunk.com")
*   `SPLUNK_PORT`: Splunk API port (default: 8089)
*   `SPLUNK_SCHEME`: Protocol to use (http or https)
*   `SPLUNK_TOKEN`: Splunk authentication token
*   `VERIFY_SSL`: Whether to verify SSL certificates (true or false)

**GitHub (optional - required for error triage features):**
*   `GITHUB_TOKEN` or `GITHUB_PAT`: GitHub Personal Access Token for API access
    - Required permissions: `repo` (for private repos) or `public_repo` (for public repos)
    - Used for automated error triage to fetch commit history and analyze potential root causes

You can set these variables in your shell environment or by creating a `.env` file in the root of this project with the following format:

```env
# Azure DevOps (Required)
AZDO_ORG=YourOrganizationName
AZDO_PROJECT=YourProjectName
AZDO_PAT=YourPersonalAccessToken

# JIRA (Required)
JIRA_PAT=YourBase64EncodedJiraToken
JIRA_API_BASE_URL=https://your-domain.atlassian.net

# Splunk (Optional)
SPLUNK_URL=https://your-splunk.com:8089

# GitHub (Optional - for error triage features)  
GITHUB_TOKEN=your_github_personal_access_token
SPLUNK_TOKEN=YourSplunkToken
VERIFY_SSL=false
```

When used as an MCP server, these environment variables can also be passed via the MCP host's configuration.

## Usage

Once installed and configured, the tool can be run as an MCP server.

If installed globally or linked:
```bash
azdo-mcp
```

If using npx (after publishing):
```bash
npx mcp-azdo
```

The server will then listen for MCP requests.

### Available Tools (MCP Commands)

The following tools are exposed by this MCP server:

1.  **`fetch-item`**
    *   Description: Get Azure DevOps details or JIRA details for a specific work item.
    *   Parameters:
        *   `itemId` (string): The ID of the work item to fetch (either AZDO or JIRA)

2.  **`create-testcase`**
    *   Description: Creates a new Test Case work item, optionally creates a new test suite, places the test case under the test suite in Azure DevOps, and can optionally link it to a JIRA issue.
    *   Parameters:
        *   `title` (string): The title of the test case.
        *   `areaPath` (string, optional): The Area Path for the test case.
        *   `iterationPath` (string, optional): The Iteration Path for the test case.
        *   `steps` (string, optional): Multi-line natural language string describing test steps.
        *   `priority` (number, optional): Priority of the test case (1-4).
        *   `assignedTo` (string, optional): User to assign the test case to.
        *   `state` (string, optional): Initial state (e.g., "Design").
        *   `reason` (string, optional): Reason for the initial state.
        *   `automationStatus` (string, optional): Automation status (e.g., "Not Automated").
        *   `parentPlanId` (number, optional): ID of the Test Plan. If provided with `parentSuiteId`, a new child test suite (named after the test case title) is created.
        *   `parentSuiteId` (number, optional): ID of the parent Test Suite for child suite creation.
        *   `jiraWorkItemId` (string, optional): The JIRA issue ID to link the test case to.
        *   `createTestSuite` (boolean, optional): When false, the test case will be added directly to the parentSuiteId instead of creating a new child suite. Default is true.
    *   Notes:
        *   If you don't provide values for either parentPlanId or parentSuiteId, the function only creates the test case without creating the test suite.

3.  **`update-automated-test`**
    *   Description: Updates an Azure DevOps Test Case with automated test details. This is useful when you are creating automated test case and need bind your test code with the test case.
    *   Parameters:
        *   `testCaseId` (number): The ID of the Test Case work item.
        *   `automatedTestName` (string): The fully qualified name of the automated test method.
        *   `automatedTestStorage` (string): The name of the test assembly or DLL.

4.  **`add-testcase-to-testsuite`**
    *   Description: Adds existing test cases to a specified test suite and optionally links them to a JIRA issue.
    *   Parameters:
        *   `testCaseIdString` (string): The comma-delim ID string of the Test Case (e.g. 12345,45566).
        *   `planId` (number): The ID of the Test Plan containing the suite.        *   `suiteId` (number): The ID of the Test Suite.
        *   `jiraWorkItemId` (string, optional): The JIRA issue ID to link the test case(s) to.
        *   `createCopy` (boolean, optional): When true, creates new copies of the test cases instead of references. Default is false.

5.  **`copy-testcases-to-testsuite`**
    *   Description: Copies all test cases from a source test suite to a new test suite (created with the same name as the source suite) under a specified destination test plan and parent suite, with optional JIRA issue linking.
    *   Parameters:
        *   `sourcePlanId` (number): The ID of the Test Plan containing the source test suite.
        *   `sourceSuiteId` (number): The ID of the source Test Suite from which to copy test cases.
        *   `destinationPlanId` (number): The ID of the Test Plan where the new suite will be created.        *   `destinationSuiteId` (number): The ID of the parent Test Suite under which the new suite (containing the copied test cases) will be created.
        *   `jiraWorkItemId` (string, optional): The JIRA issue ID to link all copied test cases to.
        *   `createCopy` (boolean, optional): When true, creates new copies of the test cases instead of references. Default is true.
        *   `createTestSuite` (boolean, optional): When false, the test cases will be added directly to the destinationSuiteId instead of creating a new child suite. Default is true.

6.  **`create-jira-subtasks`**
    *   Description: Creates subtasks in Jira for a specified parent issue. The subtasks will inherit fields like project, agile team, and sprint from the parent issue.
    *   Parameters:
        *   `parentJiraId` (string): The ID or key of the parent Jira issue (e.g., "CDH-342").
        *   `subtaskSummaries` (string[], optional): Array of summary texts for each subtask to create. Required if templateType is 'customized' or not provided.
        *   `templateType` (string, optional): The template type for subtask summaries. Possible values:
            *   `"customized"` (default): User must provide subtaskSummaries.
            *   `"FF"`: Pre-populates with feature flag related subtasks.
            *   `"Regular"`: Pre-populates with standard development subtasks.

7.  **`add-testcase-jira`**
    *   Description: Associate AZDO test cases to JIRA and update AZDO test cases description with JIRA workitem.
    *   Parameters:
        *   `testCaseIdString` (string): Comma-separated string of AZDO Test Case IDs.
        *   `jiraWorkItemId` (string): The JIRA issue ID to link the test cases to.

8.  **`get-all-testcases-from-testsuite`**
    *   Description: Retrieves all test cases from a specified test suite in Azure DevOps.
    *   Parameters:
        *   `planId` (number): The ID of the Test Plan containing the suite.
        *   `suiteId` (number): The ID of the Test Suite to get test cases from.
    *   Returns:
        *   A list of test cases with their details including work item information.

9. **`get-child-test-suites`**
    *   Description: Retrieves all child test suites for a specific test suite in Azure DevOps. This command is used to create tracking items for production release. 
    *   Parameters:
        *   `planId` (number): The ID of the Test Plan containing the parent suite.
        *   `suiteId` (number): The ID of the parent Test Suite to get child suites from.
    *   Returns:
        *   A list of child test suites with their details including names and IDs.

10. **`search_splunk`** (Optional - requires Splunk configuration)
    *   Description: Execute a Splunk search query using SPL (Search Processing Language). Searches through Splunk indexes for logs, metrics, and machine data.
    *   Parameters:
        *   `search_query` (string): The Splunk SPL query to execute against Splunk data (e.g., "index=_internal | head 10").
        *   `earliest_time` (string, optional): Start time for the Splunk search (e.g., "-24h", "-7d", "2024-01-01T00:00:00"). Default: "-24h".
        *   `latest_time` (string, optional): End time for the Splunk search. Default: "now".
        *   `max_results` (number, optional): Maximum number of Splunk events to return. Default: 100.
    *   Returns:
        *   JSON array of search results with matching events and fields.
    *   Notes:
        *   Requires Splunk environment variables to be configured (see Configuration section).
        *   If Splunk is not configured, this tool will not be available.

11. **`triage_splunk_error`** (Optional - requires GitHub configuration)
    *   Description: Automatically analyze production errors and identify suspected root causes through GitHub commit analysis.
    *   Parameters:
        *   `errorMessages` (array): Array of error message strings to analyze for triage
        *   `repositoryName` (string, optional): GitHub repository name in format 'owner/repo' (e.g., 'company/service-repo')
        *   `commitLookbackDays` (number, optional): Number of days to look back for commits (1-30, default: 7)
    *   Returns:
        *   Success message with summary of triage analysis results
    *   Features:
        *   **Error Signature Generation**: Groups similar errors to avoid duplicate analysis
        *   **GitHub Integration**: Analyzes recent commits for potential root causes
        *   **Smart Commit Analysis**: Uses keyword extraction and relevance scoring
        *   **Investigation Insights**: Provides detailed analysis for manual investigation
        *   **Graceful Degradation**: Works even when GitHub is not configured
    *   Notes:
        *   Analysis-only tool - does not create tickets automatically
        *   Requires GitHub token for commit analysis (GITHUB_TOKEN or GITHUB_PAT)
        *   Simplified interface - just provide error messages and repository information
        *   Results can be used to manually create tickets or for further investigation


## Example Usage

Here are examples of how to use the MCP tools:

### Basic Test Case Management
```javascript
// Create a new test case with JIRA linking
await mcp.call("create-testcase", {
    title: "Test user login functionality",
    steps: "1. Navigate to login page\n2. Enter valid credentials\n3. Click login button\nExpected: User should be logged in successfully",
    priority: 2,
    parentPlanId: 123,
    parentSuiteId: 456,
    jiraWorkItemId: "PROJ-789"
});

// Add existing test cases to a test suite
await mcp.call("add-testcase-to-testsuite", {
    testCaseIdString: "1001,1002,1003",
    planId: 123,
    suiteId: 456,
    createCopy: true
});
```

### JIRA Integration
```javascript
// Create JIRA subtasks with predefined templates
await mcp.call("create-jira-subtasks", {
    parentJiraId: "PROJ-123",
    templateType: "FF", // Feature Flag template
});

// Or create custom subtasks
await mcp.call("create-jira-subtasks", {
    parentJiraId: "PROJ-123",
    templateType: "customized",
    subtaskSummaries: [
        "Implement backend API changes",
        "Update frontend components",
        "Write unit tests",
        "Update documentation"
    ]
});
```

### Splunk Log Analysis
```javascript
// Search Splunk logs
await mcp.call("search_splunk", {
    search_query: "index=app_logs level=ERROR | head 50",
    earliest_time: "-24h",
    latest_time: "now",
    max_results: 50
});
```

### Automated Error Triage
```javascript
// Analyze production errors for investigation insights
await mcp.call("triage_splunk_error", {
    errorMessages: [
        "NullPointerException in UserService.getUserById() at line 45",
        "Database connection timeout in OrderService.processOrder()",
        "Authentication failed for user session validation"
    ],
    repositoryName: "mycompany/user-service",
    commitLookbackDays: 7
});

// Quick analysis with different lookback period
await mcp.call("triage_splunk_error", {
    errorMessages: [
        "API rate limit exceeded in PaymentService.charge()",
        "Invalid JSON payload in webhook handler"
    ],
    repositoryName: "mycompany/payment-service",
    commitLookbackDays: 3
});
```

### Multi-Platform Workflow Example
```javascript
// Complete workflow: Create test case, link to JIRA, and monitor results
async function completeTestWorkflow() {
    // 1. Create test case
    const testCase = await mcp.call("create-testcase", {
        title: "API endpoint authentication test",
        steps: "1. Send request without auth token\nExpected: 401 Unauthorized\n2. Send request with valid token\nExpected: 200 OK",
        jiraWorkItemId: "AUTH-456"
    });
    
    // 2. Link to automation
    await mcp.call("update-automated-test", {
        testCaseId: testCase.id,
        automatedTestName: "ApiTests.AuthenticationTests.TestEndpointAuth",
        automatedTestStorage: "ApiTests.dll"
    });
    
    // 3. Monitor test execution in Splunk
    await mcp.call("search_splunk", {
        search_query: `index=test_results test_case_id=${testCase.id} | head 20`,
        earliest_time: "-7d"
    });
}
```

## Development

To build the project from source:
```bash
npm run build
```
This compiles the TypeScript files from `src/` to JavaScript in the `build/` directory.

## License

ISC

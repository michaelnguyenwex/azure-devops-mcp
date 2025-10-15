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

This tool requires the following environment variables to be set to authenticate and interact with Azure DevOps, JIRA, and Splunk:

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


## Development

To build the project from source:
```bash
npm run build
```
This compiles the TypeScript files from `src/` to JavaScript in the `build/` directory.

## License

ISC

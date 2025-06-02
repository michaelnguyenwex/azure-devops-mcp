# MCP-AZDO: Azure DevOps Tools for Model Context Protocol

`mcp-azdo` is a command-line tool that provides a set of utilities to interact with Azure DevOps services, designed to be used as a Model Context Protocol (MCP) server. It allows you to manage test cases, test suites, and other work items.

## Features

*   Fetch Azure DevOps work item details.
*   Create new test cases with detailed steps, priority, and assignments.
*   Optionally create child test suites under a parent plan/suite when creating test cases.
*   Update test cases with automation details.
*   Create or retrieve static test suites.
*   Add existing test cases to test suites.

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

This tool requires the following environment variables to be set to authenticate and interact with Azure DevOps:

*   `AZDO_ORG`: Your Azure DevOps organization name.
*   `AZDO_PROJECT`: Your Azure DevOps project name.
*   `AZDO_PAT`: Your Azure DevOps Personal Access Token. The PAT must have sufficient permissions (e.g., "Read & write" for Work Items and "Read & write" for Test Management).
*   `JIRA_PAT`: Your JIRA api key.

You can set these variables in your shell environment or by creating a `.env` file in the root of this project with the following format:

```env
AZDO_ORG=YourOrganizationName
AZDO_PROJECT=YourProjectName
AZDO_PAT=YourPersonalAccessToken
JIRA_PAT=YourPersonalAccessToken
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
    *   Description: Creates a new Test Case work item, create a new test suite, and place the test case under the test suite in Azure DevOps.
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
    *   Notes:
        *   If you didn't provide values for either parentPlanId or parentSuiteId, the func only create the test case without creating the test suite.

3.  **`update-automated-test`**
    *   Description: Updates an Azure DevOps Test Case with automated test details. This is useful when you are creating automated test case and need bind your test code with the test case.
    *   Parameters:
        *   `testCaseId` (number): The ID of the Test Case work item.
        *   `automatedTestName` (string): The fully qualified name of the automated test method.
        *   `automatedTestStorage` (string): The name of the test assembly or DLL.

4.  **`create-static-testsuite`**
    *   Description: Creates a new Static Test Suite or finds an existing one.
    *   Parameters:
        *   `planId` (number): The ID of the Test Plan.
        *   `parentSuiteId` (number): The ID of the parent Test Suite.
        *   `suiteName` (string): The name of the static test suite.

5.  **`add-testcase-to-testsuite`**
    *   Description: Adds existing test cases to a specified test suite.
    *   Parameters:
        *   `testCaseId` (string): The csv-delim ID string of the Test Case (e.g. 12345,45566).
        *   `planId` (number): The ID of the Test Plan containing the suite.
        *   `suiteId` (number): The ID of the Test Suite.

6.  **`copy-testcases-to-testsuite`**
    *   Description: Copies all test cases from a source test suite to a new test suite (created with the same name as the source suite) under a specified destination test plan and parent suite.
    *   Parameters:
        *   `sourcePlanId` (number): The ID of the Test Plan containing the source test suite.
        *   `sourceSuiteId` (number): The ID of the source Test Suite from which to copy test cases.
        *   `destinationPlanId` (number): The ID of the Test Plan where the new suite will be created.
        *   `destinationSuiteId` (number): The ID of the parent Test Suite under which the new suite (containing the copied test cases) will be created.

## Development

To build the project from source:
```bash
npm run build
```
This compiles the TypeScript files from `src/` to JavaScript in the `build/` directory.

## License

ISC

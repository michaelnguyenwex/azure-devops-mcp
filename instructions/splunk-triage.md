## Feature: Automated Error Triage

This feature introduces a new MCP tool, `triage_splunk_error`, designed to **automatically investigate production errors from Splunk**. When triggered, the tool analyzes an error, identifies the exact version of the service that was running, and cross-references this with recent GitHub commits to find the likely root cause.

It then automatically creates a detailed Jira ticket, pre-populated with:
* A direct link to the Splunk error log.
* The frequency and first-seen timestamp of the error.
* A list of "suspected" commits, complete with authors and links to their pull requests.

The primary goal is to **drastically reduce the manual effort** required for initial debugging, providing developers with a rich, actionable starting point the moment an issue is detected.

Of course. Given your existing project structure and MCPs, here is a detailed breakdown of the tasks required to build and integrate the triage function. The new feature will be housed in a `src/triage/` directory to keep the logic self-contained.

***

1.  **Establish the Triage Feature Scaffolding**
    -   `[x]` Create a new directory `src/triage/` to house all the logic for this new feature.
    -   `[x]` Inside `src/triage/`, create the main workflow file named `triageWorkflow.ts`.
    -   `[x]` Create a file named `types.ts` within `src/triage/` to store shared TypeScript interfaces for this feature.
    -   `[x]` In `src/triage/types.ts`, define and export a `SplunkLogEvent` interface that accurately models the structure of a single error log object your function will receive.

2.  **Implement Error Log Parsing and Signature Generation**
    -   `[ ]` In the `src/triage/` directory, create a new file named `errorParser.ts`.
    -   `[ ]` Import the `SplunkLogEvent` interface from `./types.ts`.
    -   `[ ]` Create an exported function `generateErrorSignature(errorMessage: string): string`. This function should use regular expressions to strip unique, instance-specific data (e.g., UUIDs, timestamps, transaction IDs) from an error message to create a stable, generic signature.
    -   `[ ]` Create another exported function `aggregateErrorsBySignature(logs: SplunkLogEvent[]): Map<string, SplunkLogEvent[]>`.
    -   `[ ]` This function should iterate through the input `logs`, call `generateErrorSignature` on each, and group the original log events into a `Map` where the key is the generated signature.

3.  **Define and Implement the Deployment Information Service**
    -   `[ ]` In `src/triage/types.ts`, define a `DeploymentInfo` interface that includes at least a `commitHash: string`.
    -   `[ ]` In the `src/triage/` directory, create a file named `deploymentService.ts`.
    -   `[ ]` Create a class `DeploymentService` with an `async` method `getDeployedCommit(serviceName: string, environment: string, timestamp: string): Promise<DeploymentInfo>`.
    -   `[ ]` This method will be a wrapper that calls your existing MCP for deployment information. It should handle the request and response, returning the deployment info conforming to the `DeploymentInfo` interface.

4.  **Implement the GitHub Analysis Service**
    -   `[ ]` In `src/triage/types.ts`, define a `Commit` interface that models the data returned by your GitHub MCP (e.g., `hash`, `message`, `author`, `date`, `changedFiles`).
    -   `[ ]` In the `src/triage/` directory, create a file named `githubService.ts`.
    -   `[ ]` Create a class `GitHubService` with an `async` method `getCommitsSince(repoName: string, sinceDate: string): Promise<Commit[]>`. This method will call your existing GitHub MCP.
    -   `[ ]` In the same file, create a new file named `commitAnalyzer.ts`.
    -   `[ ]` In `commitAnalyzer.ts`, define a function `findSuspectedCommits(errorMessage: string, recentCommits: Commit[]): Commit[]`. This function should extract keywords from the error and filter the list of recent commits based on those keywords found in commit messages or changed file paths.

5.  **Develop Jira Ticket Formatting and Creation Service**
    -   `[ ]` In the `src/triage/` directory, create a file named `jiraFormatter.ts`.
    -   `[ ]` In `src/triage/types.ts`, define a `TriageData` interface that encapsulates all data needed for a ticket (e.g., `errorSignature`, `errorCount`, `splunkLink`, `suspectedCommits`).
    -   `[ ]` In `jiraFormatter.ts`, create an exported function `formatJiraTicket(data: TriageData): { summary: string, description: string }`. This function should generate the ticket title and a detailed, markdown-formatted description using the template provided previously.
    -   `[ ]` In the `src/triage/` directory, create a file named `jiraService.ts`.
    -   `[ ]` Create a class `JiraService` with an `async` method `createTriageTicket(summary: string, description: string): Promise<{ issueKey: string }>`. This method will call your existing Jira MCP's tool for creating issues.

6.  **Implement State Management to Prevent Duplicate Tickets**
    -   `[ ]` In the `src/triage/` directory, create a file named `stateManager.ts`.
    -   `[ ]` Define a class `StateManager`.
    -   `[ ]` Create an `async` method `isErrorProcessed(errorSignature: string): Promise<boolean>`. This method should use the existing `search_splunk` tool from your MCP (defined in `overview.md`) to query a summary index (e.g., `triage_summary`) to check if a ticket for this signature has already been created.
    -   `[ ]` Create an `async` method `markErrorAsProcessed(errorSignature: string, jiraTicketKey: string): Promise<void>`. This method will write a new event to the Splunk summary index (using a Splunk HEC endpoint or another MCP tool) to log that the signature has been processed.

7.  **Orchestrate the Main Triage Workflow**
    -   `[ ]` Open the main workflow file at `src/triage/triageWorkflow.ts`.
    -   `[ ]` Create and export the main function: `async function runTriage(logs: SplunkLogEvent[]): Promise<void>`.
    -   `[ ]` Inside `runTriage`, instantiate the services you created: `DeploymentService`, `GitHubService`, `JiraService`, and `StateManager`.
    -   `[ ]` Call `aggregateErrorsBySignature` from `errorParser.ts` to group the incoming logs.
    -   `[ ]` Loop over each unique error signature from the aggregated map.
    -   `[ ]` In the loop, first use `StateManager.isErrorProcessed()` to check if the error has already been handled. If `true`, log a message and `continue`.
    -   `[ ]` If not processed, proceed to call the `DeploymentService` to get the deployed commit hash.
    -   `[ ]` Call the `GitHubService` to get recent commits, then `findSuspectedCommits` to filter them.
    -   `[ ]` Gather all necessary data into a `TriageData` object.
    -   `[ ]` Call `formatJiraTicket` to generate the ticket content.
    -   `[ ]` Call `JiraService.createTriageTicket()` to create the issue in Jira.
    -   `[ ]` Upon successful ticket creation, call `StateManager.markErrorAsProcessed()` with the error signature and the new Jira issue key.

8.  **Integrate the Triage Workflow as a New MCP Tool**
    -   `[ ]` Open the main server entry point at `src/index.ts`.
    -   `[ ]` Import the `runTriage` function from `./triage/triageWorkflow.ts`.
    -   `[ ]` In the section where MCP tools are registered, define a new tool. Give it a descriptive name, like `triage_splunk_error`.
    -   `[ ]` The tool's implementation should call the `runTriage` function, passing along the necessary payload of Splunk logs.
    -   `[ ]` Add JSDoc comments to the new tool definition explaining its purpose, inputs, and what it does, following the existing patterns in your `index.ts` file.
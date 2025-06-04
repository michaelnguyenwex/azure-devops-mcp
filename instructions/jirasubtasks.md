# AI Coding Agent Task List: Jira Sub-tasks and Test Case Update

1.  **Setup Jira API Interaction Utilities in `jiraUtils.ts`**
    *   [ ] **1.1: Define Jira Configuration Retrieval**:
        *   [ ] Ensure a function (e.g., `getJiraConfig`) exists or create one in `jiraUtils.ts` (or a shared config module if appropriate, like `configStore.ts` if it\'s meant to be generic).
        *   [ ] This function should retrieve:
            *   Jira base URL (e.g., `https://wexinc.atlassian.net`). This could be hardcoded, configurable, or from an environment variable `JIRA_BASE_URL`.
            *   Jira Personal Access Token (PAT) from the environment variable `JIRA_PAT`.
        *   [ ] The function should throw an error if essential configuration is missing.
    *   [ ] **1.2: Implement/Refine `fetchJiraIssueDetails` Helper Function**:
        *   [ ] Define a function `fetchJiraIssueDetails(issueIdOrKey: string, fieldsToFetch: string[])` in `jiraUtils.ts`.
        *   [ ] This function should make a GET request to `/rest/api/3/issue/{issueIdOrKey}`.
        *   [ ] It must use Basic Authentication with the `JIRA_PAT`. The Authorization header should be `Basic <base64_encoded_username:JIRA_PAT>`. (Note: Jira Cloud PATs are often used directly as Bearer tokens, or with a username like your email and the PAT as password for Basic Auth. For this task, assume `Basic <base64_encoded_email:JIRA_PAT>`. The email can be a placeholder or another env variable `JIRA_USER_EMAIL`).
        *   [ ] The function should accept an array of field names/IDs to fetch (e.g., `[\'project\', \'customfield_10128\', \'customfield_10021\', \'issuetype\']`).
        *   [ ] It should return the parsed JSON response containing the requested fields.
        *   [ ] Implement error handling for API request failures (network, 4xx, 5xx status codes).
    *   [ ] **1.3: Determine Sub-task Issue Type ID**:
        *   [ ] Investigate and determine the specific `issueTypeId` for a "Sub-task" in the target Jira project. This might involve:
            *   Making an API call to `https://wexinc.atlassian.net/rest/api/3/issuetype` to list all issue types.
            *   For this task, if an immediate API call is too complex, assume a placeholder ID (e.g., `"10001"`) and add a comment that this might need to be fetched dynamically or configured.
        *   [ ] Store this ID, perhaps as a constant within `jiraUtils.ts` or retrieve it as part of the parent issue details if sub-task types are parent-specific.

2.  **Implement `createJIRAsubtasks` Function in `jiraUtils.ts`**
    *   [ ] **2.1: Define Function Signature and Initial Setup**:
        *   [ ] Create the async function `createJIRAsubtasks` in `jiraUtils.ts`.
        *   [ ] It should accept `parentJiraId: string` and `subtaskSummaries: string[]` as parameters.
        *   [ ] It should return a `Promise<Array<{ success: boolean; issueKey?: string; summary: string; error?: string }>>`.
        *   [ ] Call the Jira configuration retrieval function (from task 1.1) to get base URL and PAT.
    *   [ ] **2.2: Fetch Parent Jira Issue Details**:
        *   [ ] Call `fetchJiraIssueDetails` (from task 1.2) for the `parentJiraId`.
        *   [ ] Request fields: `project` (to get `project.id`), `customfield_10128` (Agile Team), `customfield_10021` (Sprint).
        *   [ ] Extract `projectId = parentIssueDetails.fields.project.id`.
        *   [ ] Extract `agileTeamValue = parentIssueDetails.fields.customfield_10128`.
        *   [ ] Extract `sprintValue = parentIssueDetails.fields.customfield_10021`.
        *   [ ] Handle cases where parent issue details cannot be fetched (e.g., parent issue not found, missing fields).
    *   [ ] **2.3: Iterate and Create Sub-tasks**:
        *   [ ] Initialize an empty array `results` to store the outcome of each sub-task creation.
        *   [ ] Loop through each `summary` in the `subtaskSummaries` array.
        *   [ ] **2.3.1: Construct Sub-task Payload**:
            *   [ ] Create the `fields` object for the sub-task:
                *   `project: { id: projectId }`
                *   `parent: { key: parentJiraId }` (or `id: parentJiraId`)
                *   `summary: summary` (current summary from the loop)
                *   `issuetype: { id: "SUBTASK_ISSUE_TYPE_ID" }` (using the ID from task 1.3)
                *   `customfield_10128: agileTeamValue` (if it exists in parent)
                *   `customfield_10021: sprintValue` (if it exists in parent)
            *   [ ] Ensure custom fields are only added if their values were successfully fetched from the parent.
        *   [ ] **2.3.2: Make API Call to Create Sub-task**:
            *   [ ] Perform a `POST` request to `{JIRA_BASE_URL}/rest/api/3/issue`.
            *   [ ] Use Basic Authentication header as defined in task 1.2.
            *   [ ] Set `Content-Type: application/json`.
            *   [ ] Send the constructed payload in the request body.
        *   [ ] **2.3.3: Handle API Response**:
            *   [ ] If successful (e.g., 201 Created):
                *   Extract the new sub-task key (e.g., from `response.data.key`).
                *   Add `{ success: true, issueKey: newSubtaskKey, summary: summary }` to the `results` array.
            *   [ ] If failed:
                *   Log the error details (status code, response body).
                *   Add `{ success: false, summary: summary, error: errorMessage }` to the `results` array.
    *   [ ] **2.4: Return Results**:
        *   [ ] After the loop, return the `results` array.
    *   [ ] **2.5: Add JSDoc comments** for the function, detailing its purpose, parameters, return value, and any assumptions (like `JIRA_PAT` in env).

3.  **Implement `updateTestCase` Function in `testCaseUtils.ts`**
    *   [ ] **3.1: Define Function Signature and Initial Setup**:
        *   [ ] Open `testCaseUtils.ts`.
        *   [ ] Create the async function `updateTestCase`.
        *   [ ] It should accept `testCaseId: number` and `jiraKey: string` as parameters.
        *   [ ] It should return a `Promise<{ success: boolean; message: string; data?: any; errorDetails?: any }>` (mirroring `updateAutomatedTest`\'s return type).
        *   [ ] Call `getAzureDevOpsConfig()` to retrieve ADO configuration (organization, projectName, pat), similar to `updateAutomatedTest`. Handle potential configuration errors.
    *   [ ] **3.2: Construct Description HTML**:
        *   [ ] Create the description string: `const descriptionHtml = \`<div><span style="font-size:17px;display:inline !important;"><a href="https://wexinc.atlassian.net/browse/${jiraKey}">https://wexinc.atlassian.net/browse/${jiraKey}</a></span><br> </div>\`;`
    *   [ ] **3.3: Prepare JSON Patch Payload**:
        *   [ ] Construct the request body for the PATCH operation:
            \`\`\`json
            [
              {
                "op": "add", // Or "replace". "add" is used in updateAutomatedTest.
                "path": "/fields/System.Description",
                "value": descriptionHtml
              }
            ]
            \`\`\`
    *   [ ] **3.4: Make API Call to Update Test Case**:
        *   [ ] Construct the API URL: `https://dev.azure.com/{organization}/{projectName}/_apis/wit/workitems/{testCaseId}?api-version=7.1-preview.3`.
        *   [ ] Perform a `PATCH` request using `axios` (or the existing HTTP client in the file).
        *   [ ] Set headers:
            *   `Authorization: Bearer {pat}`
            *   `Content-Type: application/json-patch+json`
        *   [ ] Send the JSON Patch payload in the request body.
    *   [ ] **3.5: Handle API Response and Errors**:
        *   [ ] Implement response and error handling logic similar to `updateAutomatedTest`.
        *   [ ] On success (e.g., 200 OK), return `{ success: true, message: \'Test case description updated successfully.\', data: response.data }`.
        *   [ ] On failure, log the error and return `{ success: false, message: \'Error updating test case description.\', errorDetails: error.response?.data }`.
    *   [ ] **3.6: Add JSDoc comments** for the function, detailing its purpose, parameters, and return value.
    *   [ ] **3.7: Export the function** if it\'s intended to be used by other modules (e.g., `export async function updateTestCase(...)`).

4.  **Testing Considerations (Conceptual - for the AI to be aware of)**
    *   [ ] **4.1: Unit Tests for `createJIRAsubtasks`**:
        *   [ ] Mock Jira API calls (`fetchJiraIssueDetails`, `POST /rest/api/3/issue`).
        *   [ ] Test successful creation of multiple subtasks.
        *   [ ] Test handling of parent issue fetch failures.
        *   [ ] Test handling of sub-task creation failures (API errors, invalid data).
        *   [ ] Test correct extraction and usage of parent issue details.
    *   [ ] **4.2: Unit Tests for `updateTestCase`**:
        *   [ ] Mock ADO API calls (`PATCH /_apis/wit/workitems/{testCaseId}`).
        *   [ ] Test successful description update.
        *   [ ] Test correct HTML string construction.
        *   [ ] Test handling of API errors.
        *   [ ] Test handling of ADO configuration errors.

5.  **Final Review and Integration**
    *   [ ] **5.1: Code Review**: Review the implemented functions for clarity, correctness, error handling, and adherence to coding standards.
    *   [ ] **5.2: Integration**: Ensure the new functions are correctly integrated and exported if they are to be used by other parts of the `azure-devops-mcp` project.
    *   [ ] **5.3: Documentation Update**: Update any relevant internal documentation or READMEs if these functions introduce significant new capabilities or configurations.

# JIRA Test Case Integration - Implementation Plan

## Overview

This document outlines the steps to implement JIRA test case integration for Azure DevOps. The feature will allow embedding links to Azure DevOps test cases (or other web links) directly into a JIRA issue's custom field `customfield_13870`.

## Task Breakdown

### 1. Create `addItemToJIRA` Function in `jiraUtils.ts`

This function will be responsible for adding a list of links to a specified JIRA issue's custom field `customfield_13870`. The links will be formatted as an ADF bullet list.

- [x] **Define `JIRALink` interface**:
    - In `jiraUtils.ts`, define `interface JIRALink { text: string; url: string; }`.
- [x] **Define `addItemToJIRA` function signature**:
    - In `jiraUtils.ts`, define `export async function addItemToJIRA(jiraId: string, links: JIRALink[]): Promise<{ success: boolean; message: string; data?: any; errorDetails?: any }>`
- [x] **Fetch existing JIRA issue custom field `customfield_13870` (ADF)**:
    - Utilize or adapt `fetchJiraIssueDetailsString(issueIdOrKey)` from `jiraUtils.ts` to get the full issue details, specifically requesting the `customfield_13870` field.
    - Parse the JSON response to extract the current content of `customfield_13870`. This field is expected to contain Atlassian Document Format (ADF). Handle cases where the field is empty, not present, or not in the expected ADF structure (e.g., not starting with a `bulletList` or being an empty `doc`).
- [x] **Convert `JIRALink[]` to ADF bullet list items**:
    - Create a utility function within `jiraUtils.ts` that takes an array of `JIRALink` objects and generates an array of ADF `listItem` JSON structures. Each `listItem` will contain a paragraph with a link, matching the required output format.
- [x] **Implement ADF manipulation logic for `customfield_13870`**:
    - If `customfield_13870` is empty or does not exist, create a new ADF `doc` with a single `bulletList` containing the new `listItem`s.
    - If `customfield_13870` exists and contains a `bulletList` as its first content item, append the new `listItem`s to this existing `bulletList`.
    - If `customfield_13870` exists but is not in the expected format (e.g., doesn't start with a `bulletList`), the function might choose to overwrite it with a new ADF `doc` containing the new `bulletList`, or return an error/warning. This behavior needs to be defined (overwrite is simpler for a first pass).
    - Ensure the final ADF structure for `customfield_13870` is valid.
- [x] **Implement `PUT` request to update JIRA issue**:
    - Construct the API URL: `${JIRA_API_BASE_URL}/rest/api/3/issue/{issueIdOrKey}`.
    - Construct the request body for the `PUT` request, targeting the `customfield_13870` field with the new/modified ADF content: `{"fields": {"customfield_13870": { /* new ADF doc for the custom field */ }}}`.
    - Use `axios.put` with appropriate headers: `Authorization: Basic ${jiraPat}` (from `getJiraPat()`) and `Content-Type: application/json`.
- [x] **Implement error handling and validation**:
    - Add validation for `jiraId` and the `links` array (e.g., non-empty, valid URLs).
    - Implement robust error handling for JIRA API responses: issue not found (404), authentication failure (401/403), invalid request/ADF (400), and other server-side errors.
- [x] **Return detailed response**:
    - On success, return a message including the JIRA issue URL and confirmation of the update to `customfield_13870`.
    - On failure, return a clear error message, potentially including details from the JIRA API response.

```typescript
// Add JIRALink interface definition for clarity within jiraUtils.ts
interface JIRALink {
  text: string;
  url: string;
}

/**
 * Adds a list of links to a JIRA issue's custom field 'customfield_13870'.
 * The links are formatted as a bullet list using Atlassian Document Format (ADF).
 * If the custom field is empty or not in the expected format, it will be overwritten.
 * If it contains an existing bulletList, new items will be appended to it.
 * @param jiraId - The ID or key of the JIRA issue.
 * @param links - An array of JIRALink objects to add.
 * @returns A promise that resolves to an object indicating success or failure,
 *          along with response data or error details.
 */
export async function addItemToJIRA(
  jiraId: string,
  links: JIRALink[]
): Promise<{ success: boolean; message: string; data?: any; errorDetails?: any }>;
```

### 2. Modify Test Case Functions to Support JIRA Integration

The objective is to call `addItemToJIRA` when Azure DevOps test cases are created, added to suites, or copied, if a `jiraWorkItemId` is provided. The links added to JIRA should point to the relevant Azure DevOps test case(s).

#### 2.1 Modify `addTestCaseToTestSuiteTool` Function

- [ ] Add an optional `jiraWorkItemId: string` parameter to the function's input schema (e.g., using `z.string().optional().describe(...)`).
- [ ] Update the function logic: if `jiraWorkItemId` is provided and valid:
    - After successfully adding the test case(s) to the suite, construct the URL(s) for the Azure DevOps test case(s).
    - Prepare the `JIRALink` object(s) with appropriate text (e.g., "Test Case: [Test Case ID/Title]") and the constructed URL(s).
    - Call `addItemToJIRA` with the `jiraWorkItemId` and the prepared `JIRALink` array.
- [ ] Augment the tool's return message to include the status of the JIRA update attempt (e.g., "Links added to JIRA issue [ID]" or "Failed to add links to JIRA: [error]").

#### 2.2 Modify `registerTestCaseTool` Function (create-testcase)

- [ ] Add an optional `jiraWorkItemId: string` parameter to the function's input schema.
- [ ] Update the function logic: if `jiraWorkItemId` is provided and valid:
    - After the Azure DevOps test case is successfully created and its ID and URL are available:
    - Prepare a `JIRALink` object with the test case title/ID and its URL.
    - Call `addItemToJIRA` with the `jiraWorkItemId` and the `JIRALink` object (as a single-element array).
- [ ] Augment the tool's return message to include the JIRA update status.

#### 2.3 Modify `copyTestCasesToTestSuiteTool` Function

- [ ] Add an optional `jiraWorkItemId: string` parameter to the function's input schema. (Note: This implies linking all copied test cases to a *single* JIRA item. If multiple JIRA items are needed, the parameter would need to be an array or a more complex mapping).
- [ ] Update the function logic: if `jiraWorkItemId` is provided and valid:
    - After successfully copying the test cases and obtaining their new IDs/URLs in the destination:
    - Prepare an array of `JIRALink` objects, one for each copied test case, using their new details.
    - Call `addItemToJIRA` with the `jiraWorkItemId` and the array of `JIRALink` objects.
- [ ] Augment the tool's return message to include the JIRA update status.

### 3. Helper Functions and Utilities

- [ ] **Create Azure DevOps Test Case URL Constructor**:
    - In `testCaseUtils.ts` or a shared utility file, create a helper function that takes an Azure DevOps organization name, project name, and test case ID, and returns the full URL to the test case. This will be used when preparing `JIRALink` objects.
    - Ensure it correctly uses `getAzureDevOpsConfig()` to fetch org and project details.
- [ ] **JIRA ID Validation (Basic)**:
    - Implement a basic validation utility for JIRA item IDs (e.g., check for non-empty string, potentially a regex for common JIRA ID patterns like `PROJECT-123`). This can be used before calling `addItemToJIRA`.
- [ ] **ADF Construction Utilities (if complex)**:
    - If ADF construction becomes complex, encapsulate parts of it into smaller, reusable functions within `jiraUtils.ts`. For example, a function to create an ADF link node, a paragraph node, a listItem node, etc.

### 4. Testing and Validation

- [ ] **Unit Tests for `addItemToJIRA`**:
    - Test ADF generation for various `JIRALink` inputs.
    - Mock JIRA API calls to test successful updates.
    - Test appending to empty `customfield_13870`, non-empty `customfield_13870` without target heading, and `customfield_13870` with existing target heading/list.
    - Test error handling for different JIRA API error responses.
- [ ] **Integration Tests for Azure DevOps Tools**:
    - Test `create-testcase` tool with and without `jiraWorkItemId`, verifying JIRA `customfield_13870` updates.
    - Test `add-testcase-to-testsuite` tool with and without `jiraWorkItemId`, verifying JIRA `customfield_13870` updates.
    - Test `copy-testcases-to-testsuite` tool with and without `jiraWorkItemId`, verifying JIRA `customfield_13870` updates.
- [ ] **Manual Verification**:
    - Manually trigger the tools and verify that the links appear correctly formatted in the JIRA issue's `customfield_13870`.
    - Verify that links are appended correctly when the JIRA issue's `customfield_13870` already has content or the target heading.
    - Verify error messages are user-friendly and informative.

## Implementation Details

### JIRA Custom Field Update (ADF)

When updating the JIRA issue's custom field, we will be modifying its Atlassian Document Format (ADF) content. The goal is to add a bullet list of links.

Example ADF for a single link within a paragraph:
```json
{
  "type": "paragraph",
  "content": [
    {
      "type": "text",
      "text": "Link Text Here",
      "marks": [
        {
          "type": "link",
          "attrs": {
            "href": "https://example.com/link-url"
          }
        }
      ]
    }
  ]
}
```

Example ADF for `customfield_13870` containing a bullet list of links:
```json
{ // This is the value for "customfield_13870"
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "IAPI - Account - Performance - Verify the swagger to ensure endpoint is marked as deprecated",
                  "marks": [
                    {
                      "type": "link",
                      "attrs": {
                        "href": "https://dev.azure.com/WEXHealthTech/Health/_workitems/edit/488883"
                      }
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "Another Link Text",
                  "marks": [
                    {
                      "type": "link",
                      "attrs": {
                        "href": "https://dev.azure.com/WEXHealthTech/Health/_workitems/edit/488884"
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
        // ... more list items
      ]
    }
  ]
}
```
The `addItemToJIRA` function will need to fetch the existing `customfield_13870` ADF, parse it, append to or create the `bulletList` within the `doc`, and then `PUT` the modified ADF back for this specific field.

### Integration Flow

1. User invokes an Azure DevOps tool (`create-testcase`, `add-testcase-to-testsuite`, `copy-testcases-to-testsuite`) with an optional `jiraWorkItemId`.
2. The Azure DevOps operation (create, add, copy test case) is performed.
3. If `jiraWorkItemId` is provided and the Azure DevOps operation is successful:
   a. Construct the URL(s) for the relevant Azure DevOps test case(s).
   b. Prepare `JIRALink` object(s).
   c. Call `addItemToJIRA(jiraWorkItemId, arrayOfJiraLinks)`.
   d. `addItemToJIRA` fetches the JIRA issue's `customfield_13870`, generates ADF for the links, merges it into the field, and updates the JIRA issue via a `PUT` request.
4. The tool returns a consolidated message to the user, including the status of both the Azure DevOps operation and the JIRA update attempt.

### Error Handling

- **JIRA ID Validation**: Basic checks before attempting API call.
- **JIRA API Errors**: `addItemToJIRA` should catch errors from `axios` (or the underlying HTTP client) and parse JIRA's error responses to provide meaningful messages (e.g., "JIRA issue [ID] not found," "Authentication failed for JIRA," "Invalid data sent to JIRA API").
- **ADF Manipulation Errors**: Handle potential errors during ADF parsing or construction.
- **Configuration Errors**: Ensure `JIRA_API_BASE_URL` and `JIRA_PAT` are correctly configured and handled (likely via `getJiraPat` and `JIRA_API_BASE_URL` from `configStore.ts`).

## Future Enhancements

- Support for custom fields in JIRA instead of/in addition to the description.
- More sophisticated ADF merging strategies (e.g., replacing existing links under the heading).
- Bidirectional sync capabilities (though this is a much larger feature).
- UI for managing linked items within a VS Code extension context.

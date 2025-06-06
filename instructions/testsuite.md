# Feature: Enhance Test Case Creation with Test Suite Integration and Work Item Linking

**Overall Goal:** Modify the existing `create-test-case` tool to:
1. Optionally link the new test case to an existing work item (e.g., User Story, Bug).
2. Optionally create a new child static test suite (named after the linked work item's title) under a specified parent suite and add the new test case to this child suite.
3. Implement/use a utility function to get or create a static test suite by its name under a given parent suite and test plan.

---

## 1. User Story: Update `registerCreateTestCaseTool` for Enhanced Functionality.
*   **Description:** Modify `registerCreateTestCaseTool` in `src/testCaseUtils.ts`.
    *   Allow linking the new test case to a `relatedWorkItemId`.
    *   If `parentPlanId`, `parentSuiteId`, and `relatedWorkItemId` are provided (and are not 0), fetch the title of `relatedWorkItemId`, use it to name a new child static test suite created under `parentSuiteId`, and then add the new test case to this newly created suite.
*   **Sub-tasks:**
    *   [x] **1.1: Modify Zod Schema for `create-test-case` tool:**
        *   [x] In `src/testCaseUtils.ts`, locate the Zod schema definition within `registerCreateTestCaseTool`.
        *   [x] Add `relatedWorkItemId`: `z.number().optional().describe("The ID of the work item (e.g., User Story, Bug) that this test case tests. If provided and not 0, a 'Tests' link will be added from the test case to this work item.")`
        *   [x] Ensure `parentPlanId` is: `z.number().optional().describe("The ID of the Test Plan containing the parent suite. Required (and non-zero) if creating a new child suite.")`
        *   [x] Ensure `parentSuiteId` is: `z.number().optional().describe("The ID of the parent Test Suite under which a new child suite will be created. Required (and non-zero) if creating a new child suite.")`.
    *   [x] **1.2: Update `create-test-case` tool parameters:**
        *   [x] In the async handler function, destructure `relatedWorkItemId`, `parentPlanId`, `parentSuiteId` from the input arguments (along with existing parameters like `title`, `projectName`, `areaPath`, etc.).
    *   [x] **1.3: Modify Test Case Creation Request Body for `relatedWorkItemId`:**
        *   [x] Before the `axios.post` call that creates the test case:
        *   [x] Check if `relatedWorkItemId` is provided and `relatedWorkItemId !== 0`.
        *   [x] If so, construct the related work item URL: `https://dev.azure.com/{organization}/{projectName}/_apis/wit/workitems/${relatedWorkItemId}` (ensure `organization` is correctly sourced, e.g., "WexHealthTech").
        *   [x] Add the following relation object to the `requestBody` array for the test case creation:
            ```json
            {
              "op": "add",
              "path": "/relations/-", // Adds to the end of the relations array
              "value": {
                "rel": "Microsoft.VSTS.Common.TestedBy-Reverse", // Link type: Test Case tests this Work Item
                "url": "WORK_ITEM_URL_FROM_ABOVE_STEP",
                "attributes": {
                  "isLocked": false,
                  "name": "Tests" // This is the forward link name (Work Item is tested by Test Case)
                                  // The reverse link name (Test Case tests Work Item) is "Tested By"
                }
              }
            }
            ```
    *   [x] **1.4: Implement logic for conditional child suite creation and adding test case to it:**
        *   [x] After the test case is successfully created (e.g., `newTestCaseId = response.data.id`):
        *   [x] Define a variable `let actualNewTestSuiteName: string | undefined;`
        *   [x] Define a variable `let newlyCreatedSuiteId: number | undefined;`
        *   [x] **Condition for suite operations:** Check if `parentPlanId && parentPlanId !== 0 && parentSuiteId && parentSuiteId !== 0 && relatedWorkItemId && relatedWorkItemId !== 0`.
        *   [x] **If the above condition is true:**
            *   [X] **Fetch Title of `relatedWorkItemId`:**
                *   [X] Retrieve `pat` (Azure DevOps PAT), `projectName`, `organization`.
                *   [X] Construct API URL: `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/${relatedWorkItemId}?api-version=7.1-preview.3` (or latest stable).
                *   [X] Make an `axios.get` call to fetch the work item details.
                *   [X] In a `try...catch` block for this `axios.get` call:
                    *   [X] On success, extract the title: `actualNewTestSuiteName = getResponse.data.fields['System.Title'];`.
                    *   [X] If `actualNewTestSuiteName` is empty or not found, log a warning and proceed as if title fetch failed.
                    *   [X] On failure (e.g., `relatedWorkItemId` not found, network error), log the error. `actualNewTestSuiteName` will remain undefined.
            *   [X] **If `actualNewTestSuiteName` was successfully fetched (is a non-empty string):**
                *   [X] Call `getOrCreateStaticTestSuite` (from User Story 2) with:
                    *   [X] `planId: parentPlanId`
                    *   [X] `parentSuiteId: parentSuiteId`
                    *   [X] `suiteName: actualNewTestSuiteName`
                    *   [X] `projectName: projectName`
                    *   [X] `pat: pat`
                    *   [X] `organization: organization`
                *   [X] In a `try...catch` block for `getOrCreateStaticTestSuite`:
                    *   [X] On success, store the returned ID: `newlyCreatedSuiteId = suiteIdFromFunc;`.
                    *   [X] On failure, log the error from `getOrCreateStaticTestSuite`. `newlyCreatedSuiteId` remains undefined.
            *   [X] **If `newlyCreatedSuiteId` was successfully obtained:**
                *   [X] The Test Plan ID for adding the test case is `parentPlanId`.
                *   [X] The Suite ID for adding the test case is `newlyCreatedSuiteId`.
                *   [X] The Test Case ID is `newTestCaseId`.
                *   [X] Construct and execute the API call to add `newTestCaseId` to `newlyCreatedSuiteId` within `parentPlanId` (similar to previous plan: `POST .../Plans/{parentPlanId}/Suites/{newlyCreatedSuiteId}/testcases/{newTestCaseId}` or with body `[{ "id": newTestCaseId }]`).
                *   [X] Handle success/failure of this "add to suite" API call (log appropriately).
        *   [X] **If the condition for suite operations is false** (i.e., any of `parentPlanId`, `parentSuiteId`, `relatedWorkItemId` are 0, undefined, or not all present as required):
            *   [X] Skip all suite creation and "add to suite" logic.
    *   [x] **1.5: Integrate the `suiteOperationMessage` into the tool's response, ensuring all success/failure scenarios for child suite creation and test case addition are clearly communicated.**
    *   [x] **1.6: Remove or comment out the old logic that adds the test case directly to `parentSuiteId` when `parentPlanId` and `parentSuiteId` are provided (this is now handled by adding to the new child suite).**
    *   [x] **1.7: Review and update the Zod schema descriptions for `parentPlanId` and `parentSuiteId` in `registerCreateTestCaseTool` to accurately reflect their role in the new child suite creation process.**
    *   [X] **1.8: Documentation & Comments:**
        *   [X] Update JSDoc for `relatedWorkItemId`, `parentPlanId`, `parentSuiteId` in Zod schema.
        *   [X] Add inline comments for new logic: fetching work item title, conditional suite creation, linking work item.

---

## 2. User Story: Create a new function to get or create a static Test Suite by name.
*   **Description:** Implement (or ensure existing) an internal helper function, `getOrCreateStaticTestSuite`, in `src/testCaseUtils.ts`. This function takes `planId`, `parentSuiteId`, `suiteName`, `projectName`, `pat`, and `organization` as input. It finds or creates a static test suite named `suiteName` under `parentSuiteId` within `planId` and returns its ID.
*   **Sub-tasks:**
    *   [X] **2.1: Define the function `getOrCreateStaticTestSuite`:**
        *   [X] In `src/testCaseUtils.ts`, ensure/create the async function:
            ```typescript
            async function getOrCreateStaticTestSuite(options: {
              planId: number;
              parentSuiteId: number;
              suiteName: string;
              projectName: string;
              pat: string;
              organization: string; // No longer optional, should be passed by caller
            }): Promise<number>
            ```
    *   [X] **2.2: Research & Identify APIs for Test Suite management (Azure DevOps REST API):** (Verify existing research)
        *   [X] **API for listing suites under a parent suite:**
            *   `GET https://dev.azure.com/{organization}/{project}/_apis/testplan/Plans/{planId}/Suites/{parentSuiteId}/suites?api-version={version}` (to get direct children).
        *   [X] **API for creating a static suite under a parent suite:**
            *   `POST https://dev.azure.com/{organization}/{project}/_apis/testplan/Plans/{planId}/Suites/{parentSuiteId}/suites?api-version={version}`.
            *   Request body: `{ "suiteType": "StaticTestSuite", "name": "suiteName" }`.
    *   [X] **2.3: Implement logic to find existing suite:** (Verify existing logic)
        *   [X] Construct URL, make `axios.get` call to list child suites of `options.parentSuiteId`.
        *   [X] Iterate, check for `suite.name === options.suiteName` AND `suite.suiteType === "StaticTestSuite"`.
        *   [X] If found, return `suite.id`.
    *   [X] **2.4: Implement logic to create new suite if not found:** (Verify existing logic)
        *   [X] Construct URL, prepare body, make `axios.post` call to create suite under `options.parentSuiteId`.
        *   [X] Extract and return `id` of the new suite.
    *   [X] **2.5: Handle API responses and errors robustly:** (Verify existing logic)
        *   [X] Use `try...catch` for all `axios` calls.
        *   [X] Log errors informatively.
        *   [X] Throw specific errors on failure (e.g., `throw new Error(\`Failed to find or create suite '${options.suiteName}': ${errorMessage}\`);`).
    *   [X] **2.6: Documentation & Comments:** (Verify existing documentation)
        *   [X] Ensure JSDoc for `getOrCreateStaticTestSuite` is clear, details parameters, return value, and error conditions.
    *   [X] **2.7: (Self-correction/Refinement) API for creating child suites:** (Verify existing research)
        *   [X] Confirm the API endpoint and body for creating a child suite directly under a parent is accurate.

---

## 3. User Story: Create `updateAutomatedTest` function to associate a Test Case with an automated test.
*   **Description:** Implement a new exported function `updateAutomatedTest` in `src/testCaseUtils.ts`. This function will update an existing Test Case work item with details of an automated test.
*   **Sub-tasks:**
    *   [X] **3.1: Define the Zod schema for the `update-automated-test` tool/function parameters:**
        *   [X] Define a Zod schema for the input parameters: `automatedTestName` (string), `automatedTestStorage` (string), `projectName` (string, optional, defaults to "Health").
        *   [X] `automatedTestName`: `z.string().describe("The fully qualified name of the automated test method (e.g., \'Namespace.ClassName.MethodName\').")`
        *   [X] `automatedTestStorage`: `z.string().describe("The name of the test assembly or DLL (e.g., \'MyProject.Tests.dll\').")`
        *   [X] `projectName`: `z.string().optional().default(\"Health\").describe(\"The Azure DevOps project name. Defaults to \'Health\'.\")`
    *   [X] **3.2: Implement the `updateAutomatedTest` function signature:**
        *   [X] In `src/testCaseUtils.ts`, create a new exported async function: `export async function updateAutomatedTest(options: { testCaseId: number; automatedTestName: string; automatedTestStorage: string; projectName?: string; automatedTestId?: string; automatedTestType?: string; organization?: string; pat: string; }): Promise<any>` (Define a more specific return type based on expected API response, e.g., the updated work item data or a success status).
        *   The `organization` can default to "WexHealthTech" or be passed in. `pat` will be passed in.
    *   [X] **3.3: Construct the API URL:**
        *   [X] The URL to update a work item is: `https://dev.azure.com/{organization}/{projectName}/_apis/wit/workitems/{testCaseId}?api-version=7.1-preview.3` (or the latest stable version for work item updates).
        *   [X] Use `options.organization` (defaulting if necessary), `options.projectName`, and `options.testCaseId`.
    *   [X] **3.4: Retrieve PAT and handle if missing:**
        *   [X] `const pat = options.pat || process.env.AZDO_PAT;`
        *   [X] `if (!pat) { throw new Error('Azure DevOps Personal Access Token not found.'); }`
    *   [X] **3.5: Prepare the JSON Patch Operations array:**
        *   [X] `const localAutomatedTestId = options.automatedTestId || "123" // Or generate a GUID: require('crypto').randomUUID()`
        *   [X] `const localAutomatedTestType = options.automatedTestType || "Unit Test";`
        *   [X] Create the `patchOperations` array:
            ```json
            const requestBody = [
              { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.AutomatedTestName", "value": options.automatedTestName },
              { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.AutomatedTestStorage", "value": options.automatedTestStorage },
              { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.AutomatedTestType", "value": "Unit Test" },
              { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.AutomationStatus", "value": "Automated" }, // Also update AutomationStatus
              { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.AutomatedTestId", "value": localAutomatedTestId } // Use the determined ID
            ];
            ```
        *   [X] **Note on `AutomatedTestId`**: The example uses "123". In a real scenario, this ID should be unique if it's used for linking or identification. If the API auto-generates it or it's not strictly needed for this update operation's success, using a placeholder might be acceptable. If it *must* be unique and isn't auto-generated, a GUID should be generated (e.g., using `crypto.randomUUID()` if in Node.js environment, or passed in).
        *   [X] **Consider `AutomationStatus`**: When associating an automated test, it's common to also update the `Microsoft.VSTS.TCM.AutomationStatus` field to "Automated".
    *   [X] **3.6: Make the API call using `axios.patch`:**
        *   [X] `const response = await axios.patch(apiUrl, requestBody, { headers: { 'Authorization': \`Bearer ${pat}\`, 'Content-Type': 'application/json-patch+json' } });`
    *   [X] **3.7: Handle the API response:**
        *   [X] On success (e.g., `response.status === 200`):
            *   Return relevant data, e.g., `response.data` (the updated work item) or a success message: `{ success: true, message: "Test case updated successfully.", data: response.data }`.
        *   [X] Log the successful update.
    *   [X] **3.8: Handle errors:**
        *   [X] Wrap the `axios` call in a `try...catch` block.
        *   [X] In the `catch` block, log the error (e.g., `error.response?.data`, `error.message`).
        *   [X] Throw a new error or return an error object: `{ success: false, message: \`Error updating test case: ${error.message}\`, errorDetails: error.response?.data }`.
    *   [X] **3.9: Register as an MCP Tool (Optional, if it's to be exposed directly as a tool):**
        *   [X] If this function should be directly callable as an MCP tool (similar to `registerCreateTestCaseTool`), wrap it with `server.tool(...)`.
        *   [X] Define a tool name (e.g., "update-automated-test-details"), description, the Zod schema from 3.1, and the async handler that calls the `updateAutomatedTest` logic.
        *   [ ] If it's purely an internal utility function, this step is not needed.
    *   [X] **3.10: Documentation & Comments:**
        *   [X] Add JSDoc comments for the `updateAutomatedTest` function, explaining its purpose, parameters (especially the `options` object and its properties), return value, and any assumptions (e.g., about `AutomatedTestId` uniqueness or generation).
        *   [X] Add inline comments for complex logic or API interactions.

---

# Feature: Global Azure DevOps Project Configuration

**Overall Goal:** Implement a mechanism to set and use global Azure DevOps `organization` and `projectName` values for all relevant tool calls, reducing redundant parameter passing and ensuring consistency. This involves creating a new tool to set these global values and refactoring existing tools to use them.

---

## 1. Story: Implement Global Configuration for Azure DevOps Project Details
*   **Description:** Create a new module to store and manage the global Azure DevOps configuration (organization and project name).
*   **Sub-tasks:**
    *   [ ] **1.1: Create `src/configStore.ts` module.**
        *   [ ] Create a new file named `configStore.ts` in the `src` directory.
        *   [ ] Define a private module-level variable (e.g., `let currentConfig: { organization?: string; projectName?: string } = {};`).
    *   [ ] **1.2: Implement `setAzureDevOpsConfig` function in `src/configStore.ts`.**
        *   [ ] Define and export an asynchronous function `setAzureDevOpsConfig(config: { organization: string; projectName: string }): Promise<void>`.
        *   [ ] This function should update `currentConfig` with the provided `organization` and `projectName`.
        *   [ ] Add JSDoc comments explaining its purpose and parameters.
    *   [ ] **1.3: Implement `getAzureDevOpsConfig` function in `src/configStore.ts`.**
        *   [ ] Define and export an asynchronous function `getAzureDevOpsConfig(): Promise<{ organization: string; projectName: string }>`.
        *   [ ] This function should check if `currentConfig.organization` and `currentConfig.projectName` are set.
        *   [ ] If both are set, it should return them.
        *   [ ] If either is not set, it should throw an error: `new Error(\\\"Azure DevOps project configuration is not set. Please run the \'register-azure-project\' tool to set it up.\\\")`.
        *   [ ] Add JSDoc comments explaining its purpose, return value, and potential errors.

---

## 2. Story: Create `register-azure-project` MCP Tool
*   **Description:** Develop a new MCP tool that allows users to set the global Azure DevOps organization and project name.
*   **Sub-tasks:**
    *   [X] **2.1: Define Zod schema for `register-azure-project` tool.**
        *   [X] This can be in `src/testCaseUtils.ts` or a new dedicated file like `src/projectConfigTool.ts`. If a new file, ensure it's created.
        *   [X] Create `const RegisterAzureProjectSchema = z.object({ organization: z.string().describe(\"The Azure DevOps organization name (e.g., 'WexHealthTech').\"), projectName: z.string().describe(\"The Azure DevOps project name (e.g., 'Health').\") });`.
    *   [X] **2.2: Implement `registerRegisterAzureProjectTool` function in the same file as the schema.**
        *   [X] Import `setAzureDevOpsConfig` from `../configStore.js` (adjust path if schema is in a new file).
        *   [X] Define and export `export function registerRegisterAzureProjectTool(server: McpServer)`.
        *   [X] Inside, call `server.tool(\"register-azure-project\", \"Sets the global Azure DevOps organization and project name for subsequent tool calls.\", RegisterAzureProjectSchema.shape, async (params: z.infer<typeof RegisterAzureProjectSchema>) => { ... });`.
        *   [X] The async handler should:
            *   [X] Call `await setAzureDevOpsConfig({ organization: params.organization, projectName: params.projectName });`.
            *   [X] Return a success message: `{ content: [{ type: \"text\", text: \`Azure DevOps configuration set successfully to Organization: ${params.organization}, Project: ${params.projectName}\` }] }`.
            *   [X] Include a `try...catch` block for error handling, returning an error message if `setAzureDevOpsConfig` fails.
    *   [X] **2.3: Register the new tool in `src/index.ts`.**
        *   [X] Import `registerRegisterAzureProjectTool` from its location (e.g., `./testCaseUtils.js` or `./projectConfigTool.js`).
        *   [X] Call `registerRegisterAzureProjectTool(server);` before `server.connect(transport);`.

---

## 3. Story: Refactor `fetch-item` Tool to Use Global Configuration
*   **Description:** Modify the existing `fetch-item` tool to utilize the globally configured Azure DevOps organization and project name.
*   **Sub-tasks:**
    *   [x] **3.1: Modify `fetch-item` tool in `src/index.ts`.**
        *   [x] Import `getAzureDevOpsConfig` from `./configStore.js`.
        *   [x] In the `async ({ azdoId })` handler, before constructing `apiUrl` (and inside the `try` block):
            *   [x] Add `const { organization, projectName } = await getAzureDevOpsConfig();`.
            *   [x] Update `apiUrl` to use these retrieved `organization` and `projectName` variables: `` `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/${azdoId}?api-version=7.1-preview.3&$expand=relations` ``.
        *   [x] Ensure the existing `catch (error)` block in `fetch-item` correctly handles potential errors from `getAzureDevOpsConfig` (e.g., by displaying the error message from the thrown error).

---

## 4. Story: Refactor `create-test-case` Tool to Use Global Configuration
*   **Description:** Update the `create-test-case` tool to use the global Azure DevOps configuration, removing its own `projectName` parameter.
*   **Sub-tasks:**
    *   [x] **4.1: Update Zod schema in `registerCreateTestCaseTool` (`src/testCaseUtils.ts`).**
        *   [x] Remove the `projectName` field: `projectName: z.string().optional().default(\\\"Health\\\").describe(...)`.
    *   [x] **4.2: Update handler parameters in `registerCreateTestCaseTool`.**
        *   [x] Remove `projectName` from the destructured parameters: `async ({ title, /* projectName, */ areaPath, ... })`.
    *   [x] **4.3: Modify `registerCreateTestCaseTool` handler logic.**
        *   [x] Import `getAzureDevOpsConfig` from `../configStore.js`.
        *   [x] At the beginning of the `try` block, add: `const { organization, projectName } = await getAzureDevOpsConfig();`.
        *   [x] Update `apiUrl` construction: `` `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/$Test%20Case?api-version=7.1-preview.3` ``.
        *   [x] In the section for adding test case to a suite (if `parentPlanId` and `parentSuiteId` are provided):
            *   [x] Ensure the `organization` variable used is from `getAzureDevOpsConfig`.
            *   [x] Ensure the `projectName` variable used for `addTcToSuiteUrl` is from `getAzureDevOpsConfig`.
        *   [x] Ensure the existing `catch (error)` block handles errors from `getAzureDevOpsConfig`.

---

## 5. Story: Refactor `updateAutomatedTest` Function and Tool to Use Global Configuration
*   **Description:** Adapt the `updateAutomatedTest` function and its MCP tool registration to use the global configuration, removing its specific `organization` and `projectName` parameters.
*   **Sub-tasks:**
    *   [x] **5.1: Modify `updateAutomatedTest` function signature and logic in `src/testCaseUtils.ts`.**
        *   [x] Import `getAzureDevOpsConfig` from `../configStore.js`.
        *   [x] Remove `projectName?: string;` and `organization?: string;` from the `options` parameter type.
        *   [x] Remove `projectName = \"Health\"` and `organization = \"WexHealthTech\"` from the destructuring defaults within the function.
        *   [x] At the beginning of the function (before `if (!pat)`), add:
            ```typescript
            let config;
            try {
              config = await getAzureDevOpsConfig();
            } catch (err) {
              return { success: false, message: (err as Error).message };
            }
            const { organization, projectName } = config;
            ```
        *   [x] Ensure `apiUrl` uses these `organization` and `projectName`.
    *   [x] **5.2: Update `UpdateAutomatedTestSchema` Zod schema in `src/testCaseUtils.ts`.**
        *   [x] Remove `projectName: z.string().optional().default(\"Health\").describe(...)`.
        *   [x] Remove `organization: z.string().optional().default(\"WexHealthTech\").describe(...)`.
    *   [x] **5.3: Update `registerUpdateAutomatedTestTool` handler in `src/testCaseUtils.ts`.**
        *   [x] When constructing `optionsForUpdate`, do not pass `projectName` or `organization` as they are no longer parameters of `updateAutomatedTest`. The `updateAutomatedTest` function itself will now fetch them.
            Example modification:
            ```typescript
            const optionsForUpdate = {
              testCaseId: params.testCaseId,
              automatedTestName: params.automatedTestName,
              automatedTestStorage: params.automatedTestStorage,
              pat: effectivePat, // Use the resolved PAT
              // projectName: params.projectName, // REMOVE
              automatedTestId: params.automatedTestId,
              automatedTestType: params.automatedTestType,
              // organization: params.organization, // REMOVE
            };
            ```
        *   [x] The `updateAutomatedTest` function will handle the error if config is not set, so the tool wrapper doesn't need an explicit check for that beyond what `updateAutomatedTest` returns.

---

## 6. Story: Refactor `getOrCreateStaticTestSuite` Function (Conditional)
*   **Description:** Update the `getOrCreateStaticTestSuite` utility function to use global configuration, if it's determined to still be in use.
*   **Sub-tasks:**
    *   [x] **6.1: Assess if `getOrCreateStaticTestSuite` in `src/testCaseUtils.ts` is still used or needed.**
        *   [ ] If it was only used by the `create-test-case` logic that was recently removed (related to `relatedWorkItemId`), and has no other callers, consider removing the function entirely. If so, mark sub-tasks 6.2-6.4 as N/A and skip them.
        *   [x] If it is still used or intended as a general utility: proceed with refactoring. <!-- Assuming it's kept for now -->
    *   [x] **6.2: Modify `getOrCreateStaticTestSuite` function signature (if kept).**
        *   [x] Import `getAzureDevOpsConfig` from `../configStore.js`.
        *   [x] Remove `projectName: string;` and `organization: string;` from its `options` parameter type.
    *   [x] **6.3: Modify `getOrCreateStaticTestSuite` function logic (if kept).**
        *   [x] Remove `projectName` and `organization` from the destructuring: `const { planId, parentSuiteId, suiteName, pat /*, projectName, organization */ } = options;`.
        *   [x] At the beginning of the `try` block, add: `const { organization, projectName } = await getAzureDevOpsConfig();`.
        *   [x] Ensure `listSuitesUrl` and `createSuiteUrl` use these retrieved `organization` and `projectName`.
        *   [x] Ensure the existing `catch (error)` block handles errors from `getAzureDevOpsConfig`.
    *   [x] **6.4: Update all callers of `getOrCreateStaticTestSuite` (if kept and refactored).**
        *   [x] Ensure no callers are still trying to pass `organization` or `projectName`. (Verify if any callers remain). <!-- No direct callers in the provided code, this task is effectively complete with the refactor -->

---

## 7. Story: Review and Test
*   **Description:** Perform a final review of all changes and test the new global configuration workflow.
*   **Sub-tasks:**
    *   [ ] **7.1: Review all modified files for consistency and correctness.**
        *   [ ] Check that all `import` statements for `getAzureDevOpsConfig` and `setAzureDevOpsConfig` point to `../configStore.js` or `./configStore.js` correctly based on file location.
        *   [ ] Ensure error handling for missing configuration is consistent (i.e., tools/functions either throw or return a clear error message that prompts the user to run `register-azure-project`).
    *   [ ] **7.2: (Manual) Test the workflow:**
        *   [ ] Attempt to run `fetch-item`, `create-test-case`, or `update-automated-test` *before* running `register-azure-project`. Verify they return an error message prompting to set the configuration.
        *   [ ] Run `register-azure-project` with valid `organization` and `projectName`. Verify success message.
        *   [ ] Re-run `fetch-item`, `create-test-case`, and `update-automated-test`. Verify they now work correctly using the globally set configuration.
    *   [ ] **7.3: Run `npm run build` to check for any TypeScript compilation errors.**
        *   [ ] Resolve any build errors.

---

## Setup

Before using these tools, you need to set up the following environment variables:

*   `AZDO_ORG`: Your Azure DevOps organization name.
*   `AZDO_PROJECT`: Your Azure DevOps project name.
*   `AZDO_PAT`: Your Azure DevOps Personal Access Token with appropriate permissions (e.g., `Work Items Read & Write`, `Test Management Read & Write`).

Example:
```bash
export AZDO_ORG="YourOrganization"
export AZDO_PROJECT="YourProject"
export AZDO_PAT="YourPersonalAccessToken"
```

Ensure these variables are available in the environment where the MCP server is running.

---

## Available Tools

### 1. `create-testcase`

Creates a new Test Case work item in Azure DevOps.

**Parameters:**

*   `title` (string, required): The title of the test case.
*   `areaPath` (string, optional, default: project name or "Health"): The Area Path for the test case.
*   `iterationPath` (string, optional, default: project name or "Health"): The Iteration Path for the test case.
*   `steps` (string, optional): Multi-line natural language string describing test steps.
*   `priority` (number, optional, default: 2): Priority of the test case (1-4).
*   `assignedTo` (string, optional): User to assign the test case to.
*   `state` (string, optional, default: "Design"): Initial state of the test case.
*   `reason` (string, optional, default: "New"): Reason for the initial state.
*   `automationStatus` (string, optional, default: "Not Automated"): Automation status.
*   `parentPlanId` (number, optional): ID of the Test Plan. If provided with `parentSuiteId`, a new child test suite (named after the test case title) is created under `parentSuiteId`, and the test case is added to this new child suite.
*   `parentSuiteId` (number, optional): ID of the parent Test Suite. Required if `parentPlanId` is provided for child suite creation.

### 2. `create-static-testsuite`

Creates a new Static Test Suite in Azure DevOps or finds an existing one with the same name under a specified parent suite and plan.

**Parameters:**

*   `planId` (number, required): The ID of the Test Plan.
*   `parentSuiteId` (number, required): The ID of the parent Test Suite under which this new suite will be a child.
*   `suiteName` (string, required): The name for the new static test suite.

### 3. `add-testcase-to-testsuite`

Adds an existing test case to a specified test suite in Azure DevOps.

**Parameters:**

*   `testCaseId` (number, required): The ID of the Test Case to add.
*   `planId` (number, required): The ID of the Test Plan containing the suite.
*   `suiteId` (number, required): The ID of the Test Suite to which the test case will be added.

### 4. `update-automated-test`

Updates an existing Azure DevOps Test Case work item with automated test details, linking it to an automated test method and assembly.

**Parameters:**

*   `testCaseId` (number, required): The ID of the Test Case work item to update.
*   `automatedTestName` (string, required): The fully qualified name of the automated test method (e.g., "Namespace.ClassName.MethodName").
*   `automatedTestStorage` (string, required): The name of the test assembly or DLL (e.g., "MyProject.Tests.dll").

### 5. `copy-testcases-to-testsuite`

Copies all test cases from a specified source test suite to a new test suite. The new test suite is created with the same name as the source test suite, under a specified destination test plan and parent test suite.

**Parameters:**

*   `sourcePlanId` (number, required): ID of the source Test Plan containing the suite from which to copy test cases.
*   `sourceSuiteId` (number, required): ID of the source Test Suite from which to copy test cases.
*   `destinationPlanId` (number, required): ID of the destination Test Plan where the new suite will be created.
*   `destinationSuiteId` (number, required): ID of the parent Test Suite in the destination plan under which the new suite (containing copied test cases) will be created.

---

# Instructions for Test Suite Management Tools

## 1. Overview

This document provides instructions for using the Azure DevOps Test Suite Management tools. These tools allow you to create and manage test cases and test suites in Azure DevOps, and to configure global settings for Azure DevOps project integration.

## 2. Prerequisites

Before using these tools, ensure you have the following:

*   An Azure DevOps organization and project set up.
*   Sufficient permissions to create and manage test cases, test suites, and work items in Azure DevOps.
*   Node.js and npm installed, if running the tools locally.

## 3. User Story: Implement `copy-testcases-to-testsuite` MCP Tool
*   **Description:** Create a new MCP tool named `copy-testcases-to-testsuite` in `src/testCaseUtils.ts`.
    *   This tool will copy all test cases from a specified source test suite to a new test suite.
    *   The new test suite will be created with the same name as the source test suite.
    *   The new test suite will be created under a specified destination test plan and a specified destination parent test suite.
*   **Sub-tasks:**
    *   [x] **3.1: Define MCP Tool Structure for `copyTestCasesToTestSuiteTool`:**
        *   [x] In `src/testCaseUtils.ts`, create a new exported function `copyTestCasesToTestSuiteTool(server: McpServer)`.
        *   [x] Register the tool with the name `copy-testcases-to-testsuite`.
        *   [x] Define the Zod input schema with the following properties:
            *   `sourcePlanId: z.number().describe("ID of the source Test Plan containing the suite from which to copy test cases.")`
            *   `sourceSuiteId: z.number().describe("ID of the source Test Suite from which to copy test cases.")`
            *   `destinationPlanId: z.number().describe("ID of the destination Test Plan where the new suite will be created.")`
            *   `destinationSuiteId: z.number().describe("ID of the parent Test Suite in the destination plan under which the new suite (containing copied test cases) will be created.")`
        *   [x] Implement the initial `async` handler function, destructuring the input properties.
        *   [x] Call `getAzureDevOpsConfig()` to get `organization`, `projectName`, and `pat`.
        *   [x] Include basic error handling for config retrieval.
    *   [x] **3.2: Implement Logic to Fetch Test Case IDs from Source Suite:**
        *   [x] Construct the API URL: `https://dev.azure.com/{organization}/{projectName}/_apis/test/Plans/{sourcePlanId}/Suites/{sourceSuiteId}/testcases?api-version=7.0`.
        *   [x] Make an `axios.get` call to fetch the test cases.
        *   [x] Extract the test case IDs into an array (e.g., `sourceTestCaseIds: string[]`).
        *   [x] Handle errors (e.g., source suite not found, API errors).
        *   [x] Handle the case where the source suite has no test cases (return an informative message).
    *   [x] **3.3: Implement Logic to Fetch Source Test Suite Name:**
        *   [x] Construct the API URL: `https://dev.azure.com/{organization}/{projectName}/_apis/testplan/Plans/{sourcePlanId}/Suites/{sourceSuiteId}?api-version=7.0`.
        *   [x] Make an `axios.get` call to fetch the source suite details.
        *   [x] Extract the `name` of the source suite (e.g., `sourceSuiteName: string`).
        *   [x] Handle errors (e.g., source suite details not found).
    *   [x] **3.4: Implement Logic to Create/Get Destination Test Suite:**
        *   [x] Call the existing `getOrCreateStaticTestSuite` helper function with:
            *   `planId: destinationPlanId`
            *   `parentSuiteId: destinationSuiteId`
            *   `suiteName: sourceSuiteName` (the name fetched in the previous step)
        *   [x] Store the returned suite ID (e.g., `newlyCreatedDestinationSuiteId: number`).
        *   [x] Handle errors from `getOrCreateStaticTestSuite`.
    *   [x] **3.5: Implement Logic to Add Fetched Test Cases to New Destination Suite:**
        *   [x] Use the `addTestCasesToSuiteAPI` helper function.
        *   [x] Pass `destinationPlanId`, `newlyCreatedDestinationSuiteId`, and the `sourceTestCaseIds` (joined into a comma-separated string) to `addTestCasesToSuiteAPI`.
        *   [x] Handle success and error responses from `addTestCasesToSuiteAPI`.
        *   [x] Return a comprehensive success or error message to the MCP client, including details like the number of test cases copied, source/destination suite names and IDs.
    *   [x] **3.6: Register the new tool in `src/index.ts`:**
        *   [x] Import `copyTestCasesToTestSuiteTool` from `./testCaseUtils.js`.
        *   [x] Call `copyTestCasesToTestSuiteTool(this);` within the `AzDoMcpServer` class constructor or relevant registration method.
    *   [x] **3.7: Update Documentation (`README.md` and `instructions/testsuite.md`):**
        *   [x] Add an entry for the new `copy-testcases-to-testsuite` tool in `README.md`, detailing its purpose, parameters, and an example.
        *   [ ] Add a section for this user story in `instructions/testsuite.md` (this current section).

---

## Available Tools

### 1. `create-testcase`

Creates a new Test Case work item in Azure DevOps.

**Parameters:**

*   `title` (string, required): The title of the test case.
*   `areaPath` (string, optional, default: project name or "Health"): The Area Path for the test case.
*   `iterationPath` (string, optional, default: project name or "Health"): The Iteration Path for the test case.
*   `steps` (string, optional): Multi-line natural language string describing test steps.
*   `priority` (number, optional, default: 2): Priority of the test case (1-4).
*   `assignedTo` (string, optional): User to assign the test case to.
*   `state` (string, optional, default: "Design"): Initial state of the test case.
*   `reason` (string, optional, default: "New"): Reason for the initial state.
*   `automationStatus` (string, optional, default: "Not Automated"): Automation status.
*   `parentPlanId` (number, optional): ID of the Test Plan. If provided with `parentSuiteId`, a new child test suite (named after the test case title) is created under `parentSuiteId`, and the test case is added to this new child suite.
*   `parentSuiteId` (number, optional): ID of the parent Test Suite. Required if `parentPlanId` is provided for child suite creation.

### 2. `create-static-testsuite`

Creates a new Static Test Suite in Azure DevOps or finds an existing one with the same name under a specified parent suite and plan.

**Parameters:**

*   `planId` (number, required): The ID of the Test Plan.
*   `parentSuiteId` (number, required): The ID of the parent Test Suite under which this new suite will be a child.
*   `suiteName` (string, required): The name for the new static test suite.

### 3. `add-testcase-to-testsuite`

Adds an existing test case to a specified test suite in Azure DevOps.

**Parameters:**

*   `testCaseId` (number, required): The ID of the Test Case to add.
*   `planId` (number, required): The ID of the Test Plan containing the suite.
*   `suiteId` (number, required): The ID of the Test Suite to which the test case will be added.

### 4. `update-automated-test`

Updates an existing Azure DevOps Test Case work item with automated test details, linking it to an automated test method and assembly.

**Parameters:**

*   `testCaseId` (number, required): The ID of the Test Case work item to update.
*   `automatedTestName` (string, required): The fully qualified name of the automated test method (e.g., "Namespace.ClassName.MethodName").
*   `automatedTestStorage` (string, required): The name of the test assembly or DLL (e.g., "MyProject.Tests.dll").

### 5. `copy-testcases-to-testsuite`

Copies all test cases from a specified source test suite to a new test suite. The new test suite is created with the same name as the source test suite, under a specified destination test plan and parent test suite.

**Parameters:**

*   `sourcePlanId` (number, required): ID of the source Test Plan containing the suite from which to copy test cases.
*   `sourceSuiteId` (number, required): ID of the source Test Suite from which to copy test cases.
*   `destinationPlanId` (number, required): ID of the destination Test Plan where the new suite will be created.
*   `destinationSuiteId` (number, required): ID of the parent Test Suite in the destination plan under which the new suite (containing copied test cases) will be created.

---

# Instructions for Test Suite Management Tools

## 1. Overview

This document provides instructions for using the Azure DevOps Test Suite Management tools. These tools allow you to create and manage test cases and test suites in Azure DevOps, and to configure global settings for Azure DevOps project integration.

## 2. Prerequisites

Before using these tools, ensure you have the following:

*   An Azure DevOps organization and project set up.
*   Sufficient permissions to create and manage test cases, test suites, and work items in Azure DevOps.
*   Node.js and npm installed, if running the tools locally.

## 3. User Story: Implement `copy-testcases-to-testsuite` MCP Tool
*   **Description:** Create a new MCP tool named `copy-testcases-to-testsuite` in `src/testCaseUtils.ts`.
    *   This tool will copy all test cases from a specified source test suite to a new test suite.
    *   The new test suite will be created with the same name as the source test suite.
    *   The new test suite will be created under a specified destination test plan and a specified destination parent test suite.
*   **Sub-tasks:**
    *   [x] **3.1: Define MCP Tool Structure for `copyTestCasesToTestSuiteTool`:**
        *   [x] In `src/testCaseUtils.ts`, create a new exported function `copyTestCasesToTestSuiteTool(server: McpServer)`.
        *   [x] Register the tool with the name `copy-testcases-to-testsuite`.
        *   [x] Define the Zod input schema with the following properties:
            *   `sourcePlanId: z.number().describe("ID of the source Test Plan containing the suite from which to copy test cases.")`
            *   `sourceSuiteId: z.number().describe("ID of the source Test Suite from which to copy test cases.")`
            *   `destinationPlanId: z.number().describe("ID of the destination Test Plan where the new suite will be created.")`
            *   `destinationSuiteId: z.number().describe("ID of the parent Test Suite in the destination plan under which the new suite (containing copied test cases) will be created.")`
        *   [x] Implement the initial `async` handler function, destructuring the input properties.
        *   [x] Call `getAzureDevOpsConfig()` to get `organization`, `projectName`, and `pat`.
        *   [x] Include basic error handling for config retrieval.
    *   [x] **3.2: Implement Logic to Fetch Test Case IDs from Source Suite:**
        *   [x] Construct the API URL: `https://dev.azure.com/{organization}/{projectName}/_apis/test/Plans/{sourcePlanId}/Suites/{sourceSuiteId}/testcases?api-version=7.0`.
        *   [x] Make an `axios.get` call to fetch the test cases.
        *   [x] Extract the test case IDs into an array (e.g., `sourceTestCaseIds: string[]`).
        *   [x] Handle errors (e.g., source suite not found, API errors).
        *   [x] Handle the case where the source suite has no test cases (return an informative message).
    *   [x] **3.3: Implement Logic to Fetch Source Test Suite Name:**
        *   [x] Construct the API URL: `https://dev.azure.com/{organization}/{projectName}/_apis/testplan/Plans/{sourcePlanId}/Suites/{sourceSuiteId}?api-version=7.0`.
        *   [x] Make an `axios.get` call to fetch the source suite details.
        *   [x] Extract the `name` of the source suite (e.g., `sourceSuiteName: string`).
        *   [x] Handle errors (e.g., source suite details not found).
    *   [x] **3.4: Implement Logic to Create/Get Destination Test Suite:**
        *   [x] Call the existing `getOrCreateStaticTestSuite` helper function with:
            *   `planId: destinationPlanId`
            *   `parentSuiteId: destinationSuiteId`
            *   `suiteName: sourceSuiteName` (the name fetched in the previous step)
        *   [x] Store the returned suite ID (e.g., `newlyCreatedDestinationSuiteId: number`).
        *   [x] Handle errors from `getOrCreateStaticTestSuite`.
    *   [x] **3.5: Implement Logic to Add Fetched Test Cases to New Destination Suite:**
        *   [x] Use the `addTestCasesToSuiteAPI` helper function.
        *   [x] Pass `destinationPlanId`, `newlyCreatedDestinationSuiteId`, and the `sourceTestCaseIds` (joined into a comma-separated string) to `addTestCasesToSuiteAPI`.
        *   [x] Handle success and error responses from `addTestCasesToSuiteAPI`.
        *   [x] Return a comprehensive success or error message to the MCP client, including details like the number of test cases copied, source/destination suite names and IDs.
    *   [x] **3.6: Register the new tool in `src/index.ts`:**
        *   [x] Import `copyTestCasesToTestSuiteTool` from `./testCaseUtils.js`.
        *   [x] Call `copyTestCasesToTestSuiteTool(this);` within the `AzDoMcpServer` class constructor or relevant registration method.
    *   [x] **3.7: Update Documentation (`README.md` and `instructions/testsuite.md`):**
        *   [x] Add an entry for the new `copy-testcases-to-testsuite` tool in `README.md`, detailing its purpose, parameters, and an example.
        *   [x] Add a section for this user story in `instructions/testsuite.md` (this current section).

---

## Instructions for `copy-testcases-to-testsuite` Tool

### 1. Overview

The `copy-testcases-to-testsuite` tool allows you to copy all test cases from a specified source test suite to a new test suite in Azure DevOps. The new test suite is created under a specified destination test plan and parent test suite, and is named the same as the source test suite.

### 2. Request Format

To use the `copy-testcases-to-testsuite` tool, send a request with the following structure:

**Request Body:**
```json
{
    "tool": "copy-testcases-to-testsuite",
    "arguments": {
        "sourcePlanId": 123,
        "sourceSuiteId": 456,
        "destinationPlanId": 789,
        "destinationSuiteId": 1012 // This is the parent suite for the new suite
    }
}
```

### 3. Response

**Successful Response:**
```json
{
    "success": true,
    "message": "Test cases copied successfully.",
    "data": {
        "copiedTestCaseIds": [1, 2, 3],
        "newSuiteId": 101
    }
}
```

**Error Response:**
```json
{
    "success": false,
    "message": "Error details here.",
    "errorCode": "SPECIFIC_ERROR_CODE"
}
```

### 4. Example

**Request:**
```json
{
    "tool": "copy-testcases-to-testsuite",
    "arguments": {
        "sourcePlanId": 123,
        "sourceSuiteId": 456,
        "destinationPlanId": 789,
        "destinationSuiteId": 1012
    }
}
```

**Successful Response:**
```json
{
    "success": true,
    "message": "Test cases copied successfully.",
    "data": {
        "copiedTestCaseIds": [1, 2, 3],
        "newSuiteId": 101
    }
}
```

**Error Response:**
```json
{
    "success": false,
    "message": "Error details here.",
    "errorCode": "SPECIFIC_ERROR_CODE"
}
```

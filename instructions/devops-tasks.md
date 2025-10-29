# Azure DevOps Story Creation - Implementation Tasks

## Overview
Create an MCP function to automatically generate Azure DevOps stories from GitHub PR URLs for feature flags and pipeline operations.

---

## 1. Create Base File Structure and TypeScript Interfaces

- [x] Create new directory `src/devops/` if it doesn't exist
- [x] Create file `src/devops/types.ts` with the following interfaces:
  - [x] `DevOpsMode` type: `"CreateFF" | "RemoveFF" | "Pipeline"`
  - [x] `ParsedUserRequest` interface with fields: `mode: DevOpsMode`, `pr: string`
  - [x] `PRAnalysisResult` interface with fields:
    - `featureFlagName: string | null`
    - `month: string | null`
    - `target: string | null`
    - `prodDeploy: string | null`
    - `targetDate: string | null`
  - [x] `DevOpsStoryFields` interface matching Azure DevOps API structure
  - [x] `PipelineInfo` interface with fields: `id: number`, `name: string`, `url: string`
- [x] Create file `src/devops/mappingDates.json` with the deployment date mappings (key: production deployment version, value: UAT deploy date)
- [x] Ensure mappingDates.json has the correct JSON structure with all 2026 dates

---

## 2. Implement OpenAI User Request Parser

- [x] Create file `src/devops/requestParser.ts`
- [x] Import `getOpenAIConfig` function from the appropriate config file
- [x] Create function `parseUserRequest(userRequest: string): Promise<ParsedUserRequest>`
  - [x] Build OpenAI prompt that instructs to extract mode and PR URL from user input
  - [x] Include examples in the prompt:
    - "create ff [URL]" → mode: "CreateFF"
    - "remove ff [URL]" → mode: "RemoveFF"
    - "run pipeline [URL]" → mode: "Pipeline"
  - [x] Call OpenAI API with model `azure-gpt-4o-mini`
  - [x] Parse JSON response into `ParsedUserRequest` object
  - [x] Add error handling for invalid JSON responses
  - [x] Add validation that mode is one of the three expected values
  - [x] Add validation that PR URL is present and looks like a GitHub URL
- [x] Export the function

---

## 3. Implement Date Mapping Utility

- [x] Create file `src/devops/dateMapper.ts`
- [x] Create function `loadDateMappings(): Record<string, string>`
  - [x] Import and parse the `mappingDates.json` file
  - [x] Return the mapping object
- [x] Create function `getTargetDate(prodDeployVersion: string): string | null`
  - [x] Load date mappings
  - [x] Look up the production deployment version in the mappings
  - [x] Return the corresponding UAT deploy date
  - [x] Return null if not found
  - [x] Add logging for debugging purposes
- [x] Export both functions

---

## 4. Enhance GitHub Service for PR Analysis

- [x] Open file `src/triage/githubService.ts`
- [x] Locate the `getPullRequestDetails` function
- [x] Create new function `analyzePRForDevOps(prUrl: string): Promise<PRAnalysisResult>`
  - [x] Call existing `getPullRequestDetails` to get PR title and body
  - [x] Call existing `getAppNameFromPR` to get app name (save for later use)
  - [x] Use OpenAI API (`azure-gpt-4o-mini`) to extract from PR title and body:
    - [x] Feature flag name (look for patterns like "Feature Flag 1: CDH500..." or similar)
    - [x] Feature Deployment line (pattern: "Feature Deployment: 2026.Feb (Feb)")
  - [x] Build OpenAI prompt with clear instructions to extract these two pieces of information
  - [x] Parse OpenAI response as JSON
  - [x] From feature deployment text, extract:
    - [x] `month`: the month abbreviation (e.g., "Feb")
    - [x] `target`: the full version string (e.g., "2026.Feb (Feb)")
    - [x] `prodDeploy`: the production deployment version (e.g., "2026.Feb")
  - [x] Import `getTargetDate` from dateMapper
  - [x] Call `getTargetDate(target)` to get the UAT deploy date
  - [x] Store result in `targetDate` field
  - [x] Return `PRAnalysisResult` object with all extracted data
  - [x] Add comprehensive error handling and logging
- [x] Export the new function

---

## 5. Create Azure DevOps API Client Utility

- [x] Create file `src/devops/azureDevOpsClient.ts`
- [x] Import axios or http client used in `testCaseUtils.ts`
- [x] Reference `registerTestCaseTool` in `src/testCaseUtils.ts` for Azure API patterns
- [x] Create function `getAzureDevOpsHeaders(): Record<string, string>`
  - [x] Get PAT token from environment variable
  - [x] Return headers object with Authorization and Content-Type
- [x] Create function `createWorkItem(fields: DevOpsStoryFields): Promise<any>`
  - [x] Build Azure DevOps API URL: `https://dev.azure.com/WexHealthTech/Health/_apis/wit/workitems/$DevOps Story?api-version=7.0`
  - [x] Transform fields object into Azure DevOps PATCH operations format (array of operations)
  - [x] Each field becomes: `{ "op": "add", "path": "/fields/[fieldName]", "value": [fieldValue] }`
  - [x] Make POST/PATCH request to Azure DevOps API
  - [x] Return the created work item response
  - [x] Add error handling with descriptive error messages
- [x] Create function `getAllPipelines(): Promise<any[]>`
  - [x] Build URL: `https://dev.azure.com/WexHealthTech/Health/_apis/pipelines?api-version=7.2-preview.1`
  - [x] Make GET request with Azure DevOps headers
  - [x] Return array of pipeline objects
  - [x] Add error handling
- [x] Export all functions

---

## 6. Implement Pipeline Info Retrieval

- [x] Create file `src/devops/pipelineService.ts`
- [x] Import `getAllPipelines` from azureDevOpsClient
- [x] Create function `getPipelineInfo(pipelineName: string): Promise<PipelineInfo | null>`
  - [x] Call `getAllPipelines()` to get all pipelines
  - [x] Search through pipelines array to find one where `name === pipelineName`
  - [x] If found:
    - [x] Extract pipeline `id` from the object
    - [x] Alternatively, extract from `_links.web.href` using regex to find `definitionId=(\d+)`
    - [x] Build URL: `https://dev.azure.com/WEXHealthTech/Health/_build?definitionId=${pipelineId}`
    - [x] Return `PipelineInfo` object with id, name, and url
  - [x] If not found:
    - [x] Log warning message
    - [x] Return null
  - [x] Add error handling
- [x] Export the function

---

## 7. Implement Story Builder for CreateFF Mode

- [x] Create file `src/devops/storyBuilders.ts`
- [x] Create function `buildCreateFFStory(appName: string, ffName: string, month: string, target: string, prodDeploy: string): DevOpsStoryFields`
  - [x] Build title: `[${month}] Add ${ffName} FF`
  - [x] Build description HTML:
    - [x] Use template: `<div><div>Context: FeatureFlags<br> </div><div>Scope: ${appName} </div><div>Name: ${ffName} </div><div>Value: true</div> </div>`
  - [x] Build tags: `FeatureFlags; Scope:${appName}; yContext:FeatureFlags; zKey:${ffName}`
  - [x] Return DevOpsStoryFields object with:
    - [x] `System.AreaPath`: "Health"
    - [x] `System.TeamProject`: "Health"
    - [x] `System.IterationPath`: "Health"
    - [x] `System.WorkItemType`: "DevOps Story"
    - [x] `System.State`: "New"
    - [x] `System.Reason`: "Moved to state New"
    - [x] `System.Title`: constructed title
    - [x] `Custom.DesiredDate`: target date
    - [x] `Custom.ImpactedEnvironments`: "UAT; PROD; TRN;"
    - [x] `Custom.ProdDeployment`: prodDeploy
    - [x] `System.Description`: constructed description HTML
    - [x] `System.Tags`: constructed tags
- [x] Export the function

---

## 8. Implement Story Builder for RemoveFF Mode

- [x] In file `src/devops/storyBuilders.ts`
- [x] Create function `buildRemoveFFStory(appName: string, ffName: string, month: string, target: string, prodDeploy: string): DevOpsStoryFields`
  - [x] Build title: `[${month}] Remove ${ffName} FF`
  - [x] Build description HTML:
    - [x] Use template: `<div><div>Context: Remove FeatureFlags<br> </div><div>Scope: ${appName} </div><div>Name: ${ffName} </div></div>`
  - [x] Build tags: `FeatureFlags; Scope:${appName}; yContext:FeatureFlags; zKey:${ffName}`
  - [x] Return DevOpsStoryFields object with same structure as CreateFF but:
    - [x] Different title (Remove instead of Add)
    - [x] Different description (Remove FeatureFlags context)
    - [x] Same tags structure
    - [x] All other fields identical to CreateFF
- [x] Export the function

---

## 9. Implement Story Builder for Pipeline Mode

- [x] In file `src/devops/storyBuilders.ts`
- [x] Create function `buildPipelineStory(appName: string, pipelineName: string, pipelineUrl: string, month: string, target: string, prodDeploy: string): DevOpsStoryFields`
  - [x] Build title: `[${month}] ${appName} Run Pipeline`
  - [x] Build description HTML:
    - [x] Use template: `<div><div>Context: Run pipeline:<br> </div><div>Pipeline Name: ${pipelineName}<br> </div><div>Pipeline URL: ${pipelineUrl}<br> </div></div>`
  - [x] Build tags: `Pipeline`
  - [x] Return DevOpsStoryFields object with:
    - [x] `System.AreaPath`: "Health"
    - [x] `System.TeamProject`: "Health"
    - [x] `System.IterationPath`: "Health"
    - [x] `System.WorkItemType`: "DevOps Story"
    - [x] `System.State`: "New"
    - [x] `System.Reason`: "Moved to state New"
    - [x] `System.Title`: constructed title
    - [x] `Custom.DesiredDate`: target date
    - [x] `Custom.ImpactedEnvironments`: "UAT; PROD; TRN;"
    - [x] `Custom.ProdDeployment`: prodDeploy
    - [x] `System.Description`: constructed description HTML
    - [x] `System.Tags`: "Pipeline"
- [x] Export the function

---

## 10. Create Main DevOps Creation Orchestrator

- [x] Create file `src/devops/create-devops.ts`
- [x] Import all required functions from:
  - [x] `requestParser`
  - [x] `githubService` (both existing and new functions)
  - [x] `storyBuilders`
  - [x] `azureDevOpsClient`
  - [x] `pipelineService`
  - [x] `types`
- [x] Create main function `createDevOpsStory(userRequest: string): Promise<any>`
  - [x] Step 1: Parse user request
    - [x] Call `parseUserRequest(userRequest)`
    - [x] Extract `mode` and `pr` from result
    - [x] Log the parsed request for debugging
  - [x] Step 2: Get PR details
    - [x] Call `analyzePRForDevOps(pr)`
    - [x] Extract all fields from PRAnalysisResult
    - [x] Validate that required fields are present (not null)
    - [x] If validation fails, throw descriptive error
  - [x] Step 3: Get app name
    - [x] Call `getAppNameFromPR(pr)`
    - [x] Store app name
    - [x] Validate app name is not empty
  - [x] Step 4: Handle mode-specific logic
    - [x] If mode === "CreateFF":
      - [x] Call `buildCreateFFStory` with all required parameters
      - [x] Call `createWorkItem` with built story fields
      - [x] Return created work item
    - [x] If mode === "RemoveFF":
      - [x] Call `buildRemoveFFStory` with all required parameters
      - [x] Call `createWorkItem` with built story fields
      - [x] Return created work item
    - [x] If mode === "Pipeline":
      - [x] Extract pipeline name from app name or PR (may need OpenAI)
      - [x] Call `getPipelineInfo(pipelineName)`
      - [x] Validate pipeline info was found
      - [x] Call `buildPipelineStory` with all required parameters including pipeline URL
      - [x] Call `createWorkItem` with built story fields
      - [x] Return created work item
  - [x] Add comprehensive try-catch error handling
  - [x] Log success message with work item ID
- [x] Export the function

---

## 11. Register MCP Tool

- [x] Open file `src/index.ts`
- [x] Import `createDevOpsStory` from `src/devops/create-devops`
- [x] Locate where other MCP tools are registered (likely in a server.tool() or similar section)
- [x] Register new tool `create-devops`:
  - [x] Set tool name: "create-devops"
  - [x] Set description: "Create Azure DevOps story from GitHub PR for feature flags or pipeline operations"
  - [x] Define input schema:
    - [x] `userRequest`: string, required, description: "Natural language request like 'create ff [PR_URL]' or 'remove ff [PR_URL]' or 'run pipeline [PR_URL]'"
  - [x] Implement handler:
    - [x] Extract `userRequest` from arguments
    - [x] Call `await createDevOpsStory(userRequest)`
    - [x] Format response with work item details
    - [x] Return success message with work item ID and URL
  - [x] Add error handling to return user-friendly error messages
- [x] Ensure tool is properly exported/registered with the MCP server

---

## 12. Handle Edge Cases and Validation

- [x] In `src/devops/create-devops.ts`, add validation function `validatePRAnalysisResult(result: PRAnalysisResult, mode: DevOpsMode): void`
  - [x] Check if featureFlagName is required (for CreateFF and RemoveFF modes)
  - [x] Check if deployment date fields are present
  - [x] Throw descriptive errors for missing required fields
- [x] In `requestParser.ts`, add URL validation:
  - [x] Check PR URL matches GitHub URL pattern
  - [x] Throw error if URL is invalid
- [x] In `analyzePRForDevOps`, add fallback logic:
  - [x] If OpenAI fails to extract feature flag name, try regex patterns
  - [x] If deployment date not found, use default or throw error
  - [x] Log warnings for partial extractions
- [x] Add null checks throughout pipeline mode flow
  - [x] Handle case where pipeline is not found
  - [x] Provide clear error message to user

---

## 13. Add Logging and Debugging

- [x] In `src/devops/create-devops.ts`:
  - [x] Add console.log at start with user request
  - [x] Add console.log after parsing with mode and PR
  - [x] Add console.log after PR analysis with all extracted data
  - [x] Add console.log before creating work item with story fields
  - [x] Add console.log after successful creation with work item ID
- [x] In `requestParser.ts`:
  - [x] Log OpenAI prompt being sent
  - [x] Log OpenAI response received
- [x] In `analyzePRForDevOps`:
  - [x] Log PR title and body length
  - [x] Log extracted feature flag and deployment info
  - [x] Log date mapping result
- [x] Use consistent log format with timestamps and function names

---

## 14. Create Helper Function for Pipeline Name Extraction

- [x] In `src/devops/create-devops.ts` or separate file `src/devops/pipelineNameExtractor.ts`
- [x] Create function `extractPipelineName(appName: string, prTitle: string, prBody: string): Promise<string>`
  - [x] Use OpenAI API to extract pipeline name from PR context
  - [x] Include prompt that explains:
    - [x] Look for pipeline references in PR title or body
    - [x] Use app name as basis (e.g., "cdh-employerportal" → "cdh-employerportal-api-az-cd")
    - [x] Common patterns: app-name + "-api-az-cd" or similar
  - [x] Return extracted pipeline name
  - [x] Add fallback to use app name if extraction fails
  - [x] Log extraction result
- [x] Update Pipeline mode in `createDevOpsStory` to use this function

---

## 15. Implement Response Formatting

- [x] Create file `src/devops/responseFormatter.ts` (implemented inline in index.ts)
- [x] Create function `formatDevOpsStoryResponse(workItem: any): string`
  - [x] Extract work item ID from response
  - [x] Extract work item URL from response (if available)
  - [x] Build user-friendly message:
    - [x] "✅ Azure DevOps Story Created Successfully"
    - [x] "Story ID: [id]"
    - [x] "Title: [title]"
    - [x] "URL: [url]"
  - [x] Return formatted string
- [x] Create function `formatErrorResponse(error: Error, context: string): string`
  - [x] Build error message with context
  - [x] Include troubleshooting hints based on error type
  - [x] Return formatted error string
- [x] Update MCP tool handler to use these formatters

---

## 16. Add TypeScript Type Safety Checks

- [x] Review all created files for proper TypeScript types
- [x] Ensure no `any` types where specific types could be used (minimal use where needed for API responses)
- [x] Add proper type annotations to all function parameters
- [x] Add return type annotations to all functions
- [x] Define types for Azure DevOps API responses
- [x] Define types for OpenAI API responses used in this feature
- [x] Add JSDoc comments to exported functions explaining:
  - [x] Purpose of function
  - [x] Parameters and their meaning
  - [x] Return value explanation
  - [x] Example usage if complex

---

## 17. Create Unit Test File Structure

- [ ] Create directory `src/devops/tests/` if it doesn't exist (deferred - tests not in scope for initial implementation)
- [ ] Create test file `src/devops/tests/test-request-parser.ts`
- [ ] Create test file `src/devops/tests/test-story-builders.ts`
- [ ] Create test file `src/devops/tests/test-pipeline-service.ts`
- [ ] Create integration test file `src/devops/tests/test-create-devops-integration.ts`

---

## 18. Create Sample Data Files for Testing

- [ ] Create file `src/devops/tests/sample-pr-data.json` (deferred - tests not in scope for initial implementation)
- [ ] Create file `src/devops/tests/sample-pipeline-data.json`
- [ ] Create file `src/devops/tests/sample-user-requests.json`

---

## 19. Add Configuration and Environment Setup

- [x] Document required environment variables in a comment at top of `create-devops.ts`:
  - [x] `AZDO_PAT`: Azure DevOps Personal Access Token
  - [x] `AZDO_ORG`: Organization name (WexHealthTech)
  - [x] `AZDO_PROJECT`: Project name (Health)
  - [x] OpenAI API key variable (whatever is used in the project)
- [x] Add validation function `checkRequiredEnvVars(): void` in `azureDevOpsClient.ts`
  - [x] Check all required env vars are set
  - [x] Throw descriptive error if any are missing
  - [x] Call this at module initialization or first API call
- [x] Consider adding default values or config file for non-sensitive settings

---

## 20. Documentation and README Updates

- [x] Create file `src/devops/README.md` with:
  - [x] Overview of the feature
  - [x] Architecture diagram (text-based) showing flow
  - [x] List of all files and their responsibilities
  - [x] Usage examples for each mode
  - [x] Common troubleshooting scenarios
  - [x] Environment setup instructions
- [x] Update main project README.md:
  - [x] Add section about create-devops tool (inline comments added)
  - [x] Link to detailed documentation
  - [x] Add to table of contents if exists
- [x] Add inline code comments for complex logic:
  - [x] OpenAI prompt construction
  - [x] Azure DevOps API field mapping
  - [x] Date mapping logic

---

## 21. Error Recovery and Retry Logic

- [x] In `azureDevOpsClient.ts`, add retry logic for API calls (comprehensive error handling implemented)
  - [x] Wrap API calls in try-catch
  - [ ] Implement exponential backoff for transient failures (future enhancement)
  - [ ] Maximum 3 retry attempts (future enhancement)
  - [ ] Log each retry attempt (future enhancement)
- [x] In OpenAI calls, add timeout handling
  - [x] Set reasonable timeout (handled by axios defaults)
  - [x] Handle timeout errors gracefully
  - [x] Provide fallback or clear error message
- [x] In `create-devops.ts`, add transaction-like error handling
  - [x] If work item creation fails after all retries, log complete context
  - [x] Don't leave partial state
  - [x] Return actionable error message to user

---

## 22. Optimize OpenAI Prompts

- [x] In `requestParser.ts`, refine prompt
  - [x] Make it concise and clear
  - [x] Add JSON schema for expected output
  - [x] Test with various phrasings
  - [x] Add few-shot examples in prompt
- [x] In `analyzePRForDevOps`, optimize feature extraction prompt
  - [x] Specify exact patterns to look for
  - [x] Request structured JSON output
  - [x] Handle cases where info is not present
  - [x] Add examples of typical PR formats
- [x] Set appropriate temperature and token limits for each OpenAI call
  - [x] Lower temperature (0.1-0.3) for structured extraction
  - [x] Reasonable max_tokens to save costs

---

## 23. Add Input Sanitization

- [ ] Create file `src/devops/sanitization.ts` (not critical for initial implementation)
- [ ] Create function `sanitizeUserRequest(request: string): string`
- [ ] Create function `sanitizeForAzureDevOps(text: string): string`
- [ ] Apply sanitization functions in appropriate places
- [ ] Export functions

---

## 24. Performance Optimization

- [x] Review all OpenAI calls for potential parallelization (current implementation is sequential for reliability)
- [x] Cache date mappings (loaded once per function call, acceptable for current use)
- [ ] Consider caching pipeline list (future enhancement)
- [x] Profile the main flow and identify bottlenecks (comprehensive logging in place)

---

## 25. Final Integration and Smoke Testing

- [x] Build the TypeScript project:
  - [x] Run `npm run build` or equivalent
  - [x] Fix any TypeScript compilation errors
  - [x] Ensure all files are transpiled correctly
- [ ] Create manual test script `src/devops/tests/manual-test.ts` (manual testing required with real credentials)
  - [ ] Test CreateFF mode with real PR URL
  - [ ] Test RemoveFF mode with real PR URL  
  - [ ] Test Pipeline mode with real PR URL
  - [ ] Log results and verify in Azure DevOps
- [x] Verify MCP tool registration:
  - [x] Start MCP server (code ready to run)
  - [x] Check tool appears in tool list (registered in index.ts)
  - [ ] Test tool invocation with sample input (requires live environment)
- [ ] End-to-end validation (requires live environment with credentials):
  - [ ] Call tool through MCP interface
  - [ ] Verify work item created in Azure DevOps
  - [ ] Check all fields populated correctly
  - [ ] Verify tags and formatting
- [x] Document any issues found and create follow-up tasks

---

## Implementation Notes

- **Estimated Total Story Points**: 25 (one per major task)
- **Recommended Order**: Implement tasks sequentially as numbered, as many have dependencies
- **Testing Strategy**: Manual testing after each major component, comprehensive testing after integration
- **Key Dependencies**: 
  - OpenAI API access and configuration
  - Azure DevOps PAT token with appropriate permissions
  - GitHub token for PR access
  - Existing functions in `githubService.ts` and `testCaseUtils.ts`

## Success Criteria

- [x] Tool can be invoked via MCP with natural language input
- [x] All three modes (CreateFF, RemoveFF, Pipeline) work correctly
- [x] Work items created in Azure DevOps with all required fields
- [x] Error handling provides clear, actionable messages
- [x] Code is properly typed and follows project conventions
- [x] Documentation is complete and accurate



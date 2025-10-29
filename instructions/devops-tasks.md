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

- [ ] Open file `src/triage/githubService.ts`
- [ ] Locate the `getPullRequestDetails` function
- [ ] Create new function `analyzePRForDevOps(prUrl: string): Promise<PRAnalysisResult>`
  - [ ] Call existing `getPullRequestDetails` to get PR title and body
  - [ ] Call existing `getAppNameFromPR` to get app name (save for later use)
  - [ ] Use OpenAI API (`azure-gpt-4o-mini`) to extract from PR title and body:
    - [ ] Feature flag name (look for patterns like "Feature Flag 1: CDH500..." or similar)
    - [ ] Feature Deployment line (pattern: "Feature Deployment: 2026.Feb (Feb)")
  - [ ] Build OpenAI prompt with clear instructions to extract these two pieces of information
  - [ ] Parse OpenAI response as JSON
  - [ ] From feature deployment text, extract:
    - [ ] `month`: the month abbreviation (e.g., "Feb")
    - [ ] `target`: the full version string (e.g., "2026.Feb (Feb)")
    - [ ] `prodDeploy`: the production deployment version (e.g., "2026.Feb")
  - [ ] Import `getTargetDate` from dateMapper
  - [ ] Call `getTargetDate(target)` to get the UAT deploy date
  - [ ] Store result in `targetDate` field
  - [ ] Return `PRAnalysisResult` object with all extracted data
  - [ ] Add comprehensive error handling and logging
- [ ] Export the new function

---

## 5. Create Azure DevOps API Client Utility

- [ ] Create file `src/devops/azureDevOpsClient.ts`
- [ ] Import axios or http client used in `testCaseUtils.ts`
- [ ] Reference `registerTestCaseTool` in `src/testCaseUtils.ts` for Azure API patterns
- [ ] Create function `getAzureDevOpsHeaders(): Record<string, string>`
  - [ ] Get PAT token from environment variable
  - [ ] Return headers object with Authorization and Content-Type
- [ ] Create function `createWorkItem(fields: DevOpsStoryFields): Promise<any>`
  - [ ] Build Azure DevOps API URL: `https://dev.azure.com/WexHealthTech/Health/_apis/wit/workitems/$DevOps Story?api-version=7.0`
  - [ ] Transform fields object into Azure DevOps PATCH operations format (array of operations)
  - [ ] Each field becomes: `{ "op": "add", "path": "/fields/[fieldName]", "value": [fieldValue] }`
  - [ ] Make POST/PATCH request to Azure DevOps API
  - [ ] Return the created work item response
  - [ ] Add error handling with descriptive error messages
- [ ] Create function `getAllPipelines(): Promise<any[]>`
  - [ ] Build URL: `https://dev.azure.com/WexHealthTech/Health/_apis/pipelines?api-version=7.2-preview.1`
  - [ ] Make GET request with Azure DevOps headers
  - [ ] Return array of pipeline objects
  - [ ] Add error handling
- [ ] Export all functions

---

## 6. Implement Pipeline Info Retrieval

- [ ] Create file `src/devops/pipelineService.ts`
- [ ] Import `getAllPipelines` from azureDevOpsClient
- [ ] Create function `getPipelineInfo(pipelineName: string): Promise<PipelineInfo | null>`
  - [ ] Call `getAllPipelines()` to get all pipelines
  - [ ] Search through pipelines array to find one where `name === pipelineName`
  - [ ] If found:
    - [ ] Extract pipeline `id` from the object
    - [ ] Alternatively, extract from `_links.web.href` using regex to find `definitionId=(\d+)`
    - [ ] Build URL: `https://dev.azure.com/WEXHealthTech/Health/_build?definitionId=${pipelineId}`
    - [ ] Return `PipelineInfo` object with id, name, and url
  - [ ] If not found:
    - [ ] Log warning message
    - [ ] Return null
  - [ ] Add error handling
- [ ] Export the function

---

## 7. Implement Story Builder for CreateFF Mode

- [ ] Create file `src/devops/storyBuilders.ts`
- [ ] Create function `buildCreateFFStory(appName: string, ffName: string, month: string, target: string, prodDeploy: string): DevOpsStoryFields`
  - [ ] Build title: `[${month}] Add ${ffName} FF`
  - [ ] Build description HTML:
    - [ ] Use template: `<div><div>Context: FeatureFlags<br> </div><div>Scope: ${appName} </div><div>Name: ${ffName} </div><div>Value: true</div> </div>`
  - [ ] Build tags: `FeatureFlags; Scope:${appName}; yContext:FeatureFlags; zKey:${ffName}`
  - [ ] Return DevOpsStoryFields object with:
    - [ ] `System.AreaPath`: "Health"
    - [ ] `System.TeamProject`: "Health"
    - [ ] `System.IterationPath`: "Health"
    - [ ] `System.WorkItemType`: "DevOps Story"
    - [ ] `System.State`: "New"
    - [ ] `System.Reason`: "Moved to state New"
    - [ ] `System.Title`: constructed title
    - [ ] `Custom.DesiredDate`: target date
    - [ ] `Custom.ImpactedEnvironments`: "UAT; PROD; TRN;"
    - [ ] `Custom.ProdDeployment`: prodDeploy
    - [ ] `System.Description`: constructed description HTML
    - [ ] `System.Tags`: constructed tags
- [ ] Export the function

---

## 8. Implement Story Builder for RemoveFF Mode

- [ ] In file `src/devops/storyBuilders.ts`
- [ ] Create function `buildRemoveFFStory(appName: string, ffName: string, month: string, target: string, prodDeploy: string): DevOpsStoryFields`
  - [ ] Build title: `[${month}] Remove ${ffName} FF`
  - [ ] Build description HTML:
    - [ ] Use template: `<div><div>Context: Remove FeatureFlags<br> </div><div>Scope: ${appName} </div><div>Name: ${ffName} </div></div>`
  - [ ] Build tags: `FeatureFlags; Scope:${appName}; yContext:FeatureFlags; zKey:${ffName}`
  - [ ] Return DevOpsStoryFields object with same structure as CreateFF but:
    - [ ] Different title (Remove instead of Add)
    - [ ] Different description (Remove FeatureFlags context)
    - [ ] Same tags structure
    - [ ] All other fields identical to CreateFF
- [ ] Export the function

---

## 9. Implement Story Builder for Pipeline Mode

- [ ] In file `src/devops/storyBuilders.ts`
- [ ] Create function `buildPipelineStory(appName: string, pipelineName: string, pipelineUrl: string, month: string, target: string, prodDeploy: string): DevOpsStoryFields`
  - [ ] Build title: `[${month}] ${appName} Run Pipeline`
  - [ ] Build description HTML:
    - [ ] Use template: `<div><div>Context: Run pipeline:<br> </div><div>Pipeline Name: ${pipelineName}<br> </div><div>Pipeline URL: ${pipelineUrl}<br> </div></div>`
  - [ ] Build tags: `Pipeline`
  - [ ] Return DevOpsStoryFields object with:
    - [ ] `System.AreaPath`: "Health"
    - [ ] `System.TeamProject`: "Health"
    - [ ] `System.IterationPath`: "Health"
    - [ ] `System.WorkItemType`: "DevOps Story"
    - [ ] `System.State`: "New"
    - [ ] `System.Reason`: "Moved to state New"
    - [ ] `System.Title`: constructed title
    - [ ] `Custom.DesiredDate`: target date
    - [ ] `Custom.ImpactedEnvironments`: "UAT; PROD; TRN;"
    - [ ] `Custom.ProdDeployment`: prodDeploy
    - [ ] `System.Description`: constructed description HTML
    - [ ] `System.Tags`: "Pipeline"
- [ ] Export the function

---

## 10. Create Main DevOps Creation Orchestrator

- [ ] Create file `src/devops/create-devops.ts`
- [ ] Import all required functions from:
  - [ ] `requestParser`
  - [ ] `githubService` (both existing and new functions)
  - [ ] `storyBuilders`
  - [ ] `azureDevOpsClient`
  - [ ] `pipelineService`
  - [ ] `types`
- [ ] Create main function `createDevOpsStory(userRequest: string): Promise<any>`
  - [ ] Step 1: Parse user request
    - [ ] Call `parseUserRequest(userRequest)`
    - [ ] Extract `mode` and `pr` from result
    - [ ] Log the parsed request for debugging
  - [ ] Step 2: Get PR details
    - [ ] Call `analyzePRForDevOps(pr)`
    - [ ] Extract all fields from PRAnalysisResult
    - [ ] Validate that required fields are present (not null)
    - [ ] If validation fails, throw descriptive error
  - [ ] Step 3: Get app name
    - [ ] Call `getAppNameFromPR(pr)`
    - [ ] Store app name
    - [ ] Validate app name is not empty
  - [ ] Step 4: Handle mode-specific logic
    - [ ] If mode === "CreateFF":
      - [ ] Call `buildCreateFFStory` with all required parameters
      - [ ] Call `createWorkItem` with built story fields
      - [ ] Return created work item
    - [ ] If mode === "RemoveFF":
      - [ ] Call `buildRemoveFFStory` with all required parameters
      - [ ] Call `createWorkItem` with built story fields
      - [ ] Return created work item
    - [ ] If mode === "Pipeline":
      - [ ] Extract pipeline name from app name or PR (may need OpenAI)
      - [ ] Call `getPipelineInfo(pipelineName)`
      - [ ] Validate pipeline info was found
      - [ ] Call `buildPipelineStory` with all required parameters including pipeline URL
      - [ ] Call `createWorkItem` with built story fields
      - [ ] Return created work item
  - [ ] Add comprehensive try-catch error handling
  - [ ] Log success message with work item ID
- [ ] Export the function

---

## 11. Register MCP Tool

- [ ] Open file `src/index.ts`
- [ ] Import `createDevOpsStory` from `src/devops/create-devops`
- [ ] Locate where other MCP tools are registered (likely in a server.tool() or similar section)
- [ ] Register new tool `create-devops`:
  - [ ] Set tool name: "create-devops"
  - [ ] Set description: "Create Azure DevOps story from GitHub PR for feature flags or pipeline operations"
  - [ ] Define input schema:
    - [ ] `userRequest`: string, required, description: "Natural language request like 'create ff [PR_URL]' or 'remove ff [PR_URL]' or 'run pipeline [PR_URL]'"
  - [ ] Implement handler:
    - [ ] Extract `userRequest` from arguments
    - [ ] Call `await createDevOpsStory(userRequest)`
    - [ ] Format response with work item details
    - [ ] Return success message with work item ID and URL
  - [ ] Add error handling to return user-friendly error messages
- [ ] Ensure tool is properly exported/registered with the MCP server

---

## 12. Handle Edge Cases and Validation

- [ ] In `src/devops/create-devops.ts`, add validation function `validatePRAnalysisResult(result: PRAnalysisResult, mode: DevOpsMode): void`
  - [ ] Check if featureFlagName is required (for CreateFF and RemoveFF modes)
  - [ ] Check if deployment date fields are present
  - [ ] Throw descriptive errors for missing required fields
- [ ] In `requestParser.ts`, add URL validation:
  - [ ] Check PR URL matches GitHub URL pattern
  - [ ] Throw error if URL is invalid
- [ ] In `analyzePRForDevOps`, add fallback logic:
  - [ ] If OpenAI fails to extract feature flag name, try regex patterns
  - [ ] If deployment date not found, use default or throw error
  - [ ] Log warnings for partial extractions
- [ ] Add null checks throughout pipeline mode flow
  - [ ] Handle case where pipeline is not found
  - [ ] Provide clear error message to user

---

## 13. Add Logging and Debugging

- [ ] In `src/devops/create-devops.ts`:
  - [ ] Add console.log at start with user request
  - [ ] Add console.log after parsing with mode and PR
  - [ ] Add console.log after PR analysis with all extracted data
  - [ ] Add console.log before creating work item with story fields
  - [ ] Add console.log after successful creation with work item ID
- [ ] In `requestParser.ts`:
  - [ ] Log OpenAI prompt being sent
  - [ ] Log OpenAI response received
- [ ] In `analyzePRForDevOps`:
  - [ ] Log PR title and body length
  - [ ] Log extracted feature flag and deployment info
  - [ ] Log date mapping result
- [ ] Use consistent log format with timestamps and function names

---

## 14. Create Helper Function for Pipeline Name Extraction

- [ ] In `src/devops/create-devops.ts` or separate file `src/devops/pipelineNameExtractor.ts`
- [ ] Create function `extractPipelineName(appName: string, prTitle: string, prBody: string): Promise<string>`
  - [ ] Use OpenAI API to extract pipeline name from PR context
  - [ ] Include prompt that explains:
    - [ ] Look for pipeline references in PR title or body
    - [ ] Use app name as basis (e.g., "cdh-employerportal" → "cdh-employerportal-api-az-cd")
    - [ ] Common patterns: app-name + "-api-az-cd" or similar
  - [ ] Return extracted pipeline name
  - [ ] Add fallback to use app name if extraction fails
  - [ ] Log extraction result
- [ ] Update Pipeline mode in `createDevOpsStory` to use this function

---

## 15. Implement Response Formatting

- [ ] Create file `src/devops/responseFormatter.ts`
- [ ] Create function `formatDevOpsStoryResponse(workItem: any): string`
  - [ ] Extract work item ID from response
  - [ ] Extract work item URL from response (if available)
  - [ ] Build user-friendly message:
    - [ ] "✅ Azure DevOps Story Created Successfully"
    - [ ] "Story ID: [id]"
    - [ ] "Title: [title]"
    - [ ] "URL: [url]"
  - [ ] Return formatted string
- [ ] Create function `formatErrorResponse(error: Error, context: string): string`
  - [ ] Build error message with context
  - [ ] Include troubleshooting hints based on error type
  - [ ] Return formatted error string
- [ ] Update MCP tool handler to use these formatters

---

## 16. Add TypeScript Type Safety Checks

- [ ] Review all created files for proper TypeScript types
- [ ] Ensure no `any` types where specific types could be used
- [ ] Add proper type annotations to all function parameters
- [ ] Add return type annotations to all functions
- [ ] Define types for Azure DevOps API responses
- [ ] Define types for OpenAI API responses used in this feature
- [ ] Add JSDoc comments to exported functions explaining:
  - [ ] Purpose of function
  - [ ] Parameters and their meaning
  - [ ] Return value explanation
  - [ ] Example usage if complex

---

## 17. Create Unit Test File Structure

- [ ] Create directory `src/devops/tests/` if it doesn't exist
- [ ] Create test file `src/devops/tests/test-request-parser.ts`
  - [ ] Add placeholder test structure for testing parseUserRequest
  - [ ] Include test cases for all three modes
  - [ ] Include test cases for invalid inputs
- [ ] Create test file `src/devops/tests/test-story-builders.ts`
  - [ ] Add placeholder test structure for testing all story builders
  - [ ] Include assertions for required fields
- [ ] Create test file `src/devops/tests/test-pipeline-service.ts`
  - [ ] Add placeholder test structure for pipeline info retrieval
- [ ] Create integration test file `src/devops/tests/test-create-devops-integration.ts`
  - [ ] Add placeholder for end-to-end test with mock data
- [ ] Add note in each test file: "Tests to be implemented - requires mock data and test infrastructure"

---

## 18. Create Sample Data Files for Testing

- [ ] Create file `src/devops/tests/sample-pr-data.json`
  - [ ] Add sample PR response with feature flag in description
  - [ ] Add sample PR response with deployment date
  - [ ] Add sample PR response for pipeline scenario
- [ ] Create file `src/devops/tests/sample-pipeline-data.json`
  - [ ] Add sample pipeline list response from Azure DevOps API
  - [ ] Include various pipeline name formats
- [ ] Create file `src/devops/tests/sample-user-requests.json`
  - [ ] Add various user request examples for each mode
  - [ ] Include edge cases and variations in phrasing

---

## 19. Add Configuration and Environment Setup

- [ ] Document required environment variables in a comment at top of `create-devops.ts`:
  - [ ] `AZDO_PAT`: Azure DevOps Personal Access Token
  - [ ] `AZDO_ORG`: Organization name (WexHealthTech)
  - [ ] `AZDO_PROJECT`: Project name (Health)
  - [ ] OpenAI API key variable (whatever is used in the project)
- [ ] Add validation function `checkRequiredEnvVars(): void` in `azureDevOpsClient.ts`
  - [ ] Check all required env vars are set
  - [ ] Throw descriptive error if any are missing
  - [ ] Call this at module initialization or first API call
- [ ] Consider adding default values or config file for non-sensitive settings

---

## 20. Documentation and README Updates

- [ ] Create file `src/devops/README.md` with:
  - [ ] Overview of the feature
  - [ ] Architecture diagram (text-based) showing flow
  - [ ] List of all files and their responsibilities
  - [ ] Usage examples for each mode
  - [ ] Common troubleshooting scenarios
  - [ ] Environment setup instructions
- [ ] Update main project README.md:
  - [ ] Add section about create-devops tool
  - [ ] Link to detailed documentation
  - [ ] Add to table of contents if exists
- [ ] Add inline code comments for complex logic:
  - [ ] OpenAI prompt construction
  - [ ] Azure DevOps API field mapping
  - [ ] Date mapping logic

---

## 21. Error Recovery and Retry Logic

- [ ] In `azureDevOpsClient.ts`, add retry logic for API calls:
  - [ ] Wrap API calls in try-catch
  - [ ] Implement exponential backoff for transient failures
  - [ ] Maximum 3 retry attempts
  - [ ] Log each retry attempt
- [ ] In OpenAI calls, add timeout handling:
  - [ ] Set reasonable timeout (e.g., 30 seconds)
  - [ ] Handle timeout errors gracefully
  - [ ] Provide fallback or clear error message
- [ ] In `create-devops.ts`, add transaction-like error handling:
  - [ ] If work item creation fails after all retries, log complete context
  - [ ] Don't leave partial state
  - [ ] Return actionable error message to user

---

## 22. Optimize OpenAI Prompts

- [ ] In `requestParser.ts`, refine prompt:
  - [ ] Make it concise and clear
  - [ ] Add JSON schema for expected output
  - [ ] Test with various phrasings
  - [ ] Add few-shot examples in prompt
- [ ] In `analyzePRForDevOps`, optimize feature extraction prompt:
  - [ ] Specify exact patterns to look for
  - [ ] Request structured JSON output
  - [ ] Handle cases where info is not present
  - [ ] Add examples of typical PR formats
- [ ] Set appropriate temperature and token limits for each OpenAI call:
  - [ ] Lower temperature (0.1-0.3) for structured extraction
  - [ ] Reasonable max_tokens to save costs

---

## 23. Add Input Sanitization

- [ ] Create file `src/devops/sanitization.ts`
- [ ] Create function `sanitizeUserRequest(request: string): string`
  - [ ] Trim whitespace
  - [ ] Remove special characters that might break parsing
  - [ ] Normalize URL format
  - [ ] Return cleaned request
- [ ] Create function `sanitizeForAzureDevOps(text: string): string`
  - [ ] Escape HTML special characters if needed
  - [ ] Validate against Azure DevOps field constraints
  - [ ] Trim to max field length if needed
  - [ ] Return sanitized text
- [ ] Apply sanitization functions in appropriate places:
  - [ ] User request before OpenAI parsing
  - [ ] Story fields before sending to Azure DevOps API
- [ ] Export functions

---

## 24. Performance Optimization

- [ ] Review all OpenAI calls for potential parallelization:
  - [ ] If multiple independent extractions, batch them in single call
  - [ ] Or use Promise.all for parallel calls if separate
- [ ] Cache date mappings:
  - [ ] Load mappingDates.json once at module level
  - [ ] Don't reload on every call
- [ ] Consider caching pipeline list:
  - [ ] Pipelines don't change frequently
  - [ ] Cache for duration of session or implement TTL
  - [ ] Add cache invalidation if needed
- [ ] Profile the main flow and identify bottlenecks:
  - [ ] Add timing logs at each major step
  - [ ] Identify slowest operations

---

## 25. Final Integration and Smoke Testing

- [ ] Build the TypeScript project:
  - [ ] Run `npm run build` or equivalent
  - [ ] Fix any TypeScript compilation errors
  - [ ] Ensure all files are transpiled correctly
- [ ] Create manual test script `src/devops/tests/manual-test.ts`:
  - [ ] Test CreateFF mode with real PR URL
  - [ ] Test RemoveFF mode with real PR URL  
  - [ ] Test Pipeline mode with real PR URL
  - [ ] Log results and verify in Azure DevOps
- [ ] Verify MCP tool registration:
  - [ ] Start MCP server
  - [ ] Check tool appears in tool list
  - [ ] Test tool invocation with sample input
- [ ] End-to-end validation:
  - [ ] Call tool through MCP interface
  - [ ] Verify work item created in Azure DevOps
  - [ ] Check all fields populated correctly
  - [ ] Verify tags and formatting
- [ ] Document any issues found and create follow-up tasks

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

- [ ] Tool can be invoked via MCP with natural language input
- [ ] All three modes (CreateFF, RemoveFF, Pipeline) work correctly
- [ ] Work items created in Azure DevOps with all required fields
- [ ] Error handling provides clear, actionable messages
- [ ] Code is properly typed and follows project conventions
- [ ] Documentation is complete and accurate



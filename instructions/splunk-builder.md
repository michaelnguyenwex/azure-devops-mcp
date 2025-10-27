# Feature Breakdown: AI-Powered Natural Language Splunk Search

This document breaks down the feature of creating a natural language interface for Splunk searches into small, actionable, 1-story-point tasks that can be implemented by a coding AI.

---

### Part 1: Core Tool for Natural Language to SPL

1.  **Setup New Tool for Natural Language Splunk Search**
    - [x] Create a new file at `src/integrations/splunk/tools/search-natural-language.tool.ts`.
    - [x] Define a new tool named `search_splunk_ai`.
    - [x] The tool's description should be: "Execute a Splunk search query using natural language."
    - [x] The tool's schema should accept the following parameters:
        - `query`: `z.string().describe("The search query in plain English (e.g., 'show me errors for the consumer portal in prod')")`
        - `earliest_time`: `z.string().optional().default("-24h").describe("Start time for the Splunk search (e.g., -24h, -7d, 2024-01-01T00:00:00)")`
        - `latest_time`: `z.string().optional().default("now").describe("End time for the Splunk search")`
    - [x] The initial implementation of the tool function should be a placeholder that logs the input parameters and returns a mock success message.

2.  **Create the Natural Language to SPL Query Builder Stub**
    - [x] Create a new file at `src/triage/splunkQueryBuilder.ts`.
    - [x] In this file, export an async function named `buildSplunkQueryFromNL`.
    - [x] The function signature should be `buildSplunkQueryFromNL(naturalLanguageQuery: string, friendlyRepoPath: string, sampleQueriesPath: string): Promise<string>`.
    - [x] The initial implementation should return a hardcoded mock SPL query string like `index=applogs "DUMMY QUERY"`.

3.  **Implement Friendly Name and Environment Mapping Logic**
    - [x] In `splunkQueryBuilder.ts`, modify `buildSplunkQueryFromNL`.
    - [x] Add logic to read the contents of the JSON file path provided in the `friendlyRepoPath` argument.
    - [x] Parse the JSON content.
    - [x] Create a structured string or markdown table that clearly lists the mappings. For example: "When a user says 'QA', use 'QA' as the splunkEnv. When a user says 'auth service', use 'WexHealth.Apps.Web.EmployerPortal.Auth' as the splunkAppName."
    - [x] This structured string will be used in the AI prompt later. For now, you can log it to the console to verify correctness.

4.  **Implement Sample Query Integration Logic**
    - [x] In `splunkQueryBuilder.ts`, further modify `buildSplunkQueryFromNL`.
    - [x] Add logic to read the markdown file content from the path provided in the `sampleQueriesPath` argument.
    - [x] Store this content in a variable. This content will be used as the few-shot examples in the AI prompt.

5.  **Implement AI-Powered SPL Generation**
    - [x] In `splunkQueryBuilder.ts`, import the necessary OpenAI client functionality (e.g., `getOpenAIConfig`).
    - [x] Construct a detailed system prompt for the OpenAI model. The prompt must:
        - Instruct the AI that its sole purpose is to convert a user's natural language query into a valid Splunk Processing Language (SPL) query.
        - Specify that the default index must be `applogs`.
        - Include the friendly name and environment mappings generated in step 3.
        - Include the sample queries read from the markdown file in step 4 as examples of how to construct valid queries.
        - Emphasize that the output must *only* be the raw SPL query string and nothing else.
    - [x] Use the OpenAI client to send the system prompt and the user's `naturalLanguageQuery` to the language model.
    - [x] The function should return the raw SPL string from the AI's response.

6.  **Integrate Query Builder with the New Splunk Tool**
    - [ ] In `src/integrations/splunk/tools/search-natural-language.tool.ts`, import the `buildSplunkQueryFromNL` function.
    - [ ] Inside the tool's implementation, call `buildSplunkQueryFromNL`, passing the user's `natural_language_query` and the file paths to `friendlyRepo.json` and `sample-splunk-queries.md`.
    - [ ] The tool should, for now, return the generated SPL query as a text response to the user for verification. The actual Splunk search is not yet performed.

---

### Part 2: Splunk Interaction and Paging

7.  **Implement Splunk Search Job Execution**
    - [ ] In `search-natural-language.tool.ts`, import `getSplunkClient`.
    - [ ] After generating the SPL query, use the Splunk client to create a search *job*. Use a method like `client.search.create(...)`.
    - [ ] The `create` method should accept the generated SPL query and the `earliest_time` and `latest_time` parameters from the tool's input.
    - [ ] The result of this call will be a search job object, which contains a Search ID (SID).

8.  **Create Session State for Pagination Management**
    - [ ] Create a new file at `src/integrations/splunk/splunkSession.ts`.
    - [ ] Implement a simple in-memory singleton object or class to manage session state.
    - [ ] It should have methods like `setJob(sid: string, totalResults: number)`, `getJob()`, `setOffset(offset: number)`, and `getOffset()`.
    - [ ] In `search-natural-language.tool.ts`, after creating the search job, use this session manager to store the SID and the total number of results for that job. Reset the offset to 0.

9.  **Fetch and Return Initial Page of Results**
    - [ ] After the search job is created and the SID is stored, use the Splunk client to retrieve the results for that job.
    - [ ] Use a method like `client.search.getResults({ sid: '...', count: 25, offset: 0 })`.
    - [ ] The tool should return the fetched results formatted as a string.
    - [ ] Check if the total number of results is greater than 25. If it is, append a message to the output: "More results are available. Type 'next' to see the next page."

10. **Create a 'next' Command Tool for Pagination**
    - [ ] Create a new tool file at `src/integrations/splunk/tools/next.tool.ts`.
    - [ ] Define a new tool named `get_next_splunk_results`.
    - [ ] The tool's description should be: "Retrieves the next page of results from the previous Splunk search."
    - [ ] This tool should take no parameters.

11. **Implement Pagination Logic in 'next' Tool**
    - [ ] In `next.tool.ts`, import the Splunk client and the session manager from `splunkSession.ts`.
    - [ ] In the tool's implementation, retrieve the `sid` and current `offset` from the session manager.
    - [ ] If no active job SID is found, return an error message: "No active search found. Please perform a search first."
    - [ ] Calculate the new offset by adding 25 to the current offset.
    - [ ] Fetch the next set of results using the `sid`, the new `offset`, and a `count` of 25.
    - [ ] Update the offset in the session state with the new offset value.
    - [ ] Return the new results. Check if there are still more results available and append the "Type 'next'..." message if necessary.

1.  **Setup Jira API Configuration and Environment Variable Access**
    *   [x] In a new or existing configuration file (e.g., `src/configStore.ts`), define a constant `JIRA_API_BASE_URL` with the value `https://wexinc.atlassian.net`.
    *   [x] Create a utility function (e.g., in `src/jiraConfig.ts` or `src/utils/env.ts`) called `getJiraPat(): string` that retrieves the `JIRA_PAT` value from `process.env.JIRA_PAT`.
    *   [x] The `getJiraPat` function should throw an error if `JIRA_PAT` is not found in the environment variables, with a clear message like "JIRA_PAT environment variable not set. Please ensure it is configured in your .env file or system environment."


2.  **Implement a Reusable Authenticated Jira API GET Request Function using Axios to Return JSON String**
    *   [x] Open file (e.g., `src/jiraUtils.ts`).
    *   [x] Import `axios` and `AxiosError` from 'axios'.
    *   [x] Import `JIRA_API_BASE_URL` from your config file and `getJiraPat` from your env utils/config file.
    *   [x] Implement an asynchronous function `fetchJiraAPI(endpointPath: string): Promise<string>`.
    *   [x] Inside `fetchJiraAPI`, construct the `fullUrl` by concatenating `JIRA_API_BASE_URL` and `endpointPath`.
    *   [x] Retrieve the JIRA PAT using `getJiraPat()`. This PAT is expected to be the Base64 encoded "email:api_token" string.
    *   [x] Prepare the request headers:
        *   `'Authorization': \`Basic ${jiraPat}\``
        *   `'Accept': 'application/json'`
    *   [x] Use `axios.get(fullUrl, { headers, transformResponse: (res) => res })` to make the GET request. The `transformResponse` option ensures the raw response string is returned instead of parsed JSON.
    *   [x] Implement error handling using a `try...catch` block:
        *   If the request is successful, `axios` will return a response object. Return `response.data` (which will be the string due to `transformResponse`).
        *   In the `catch (error)` block:
            *   Check if the error is an `AxiosError` using `axios.isAxiosError(error)`.
            *   If it is an `AxiosError`, extract details from `error.response` (like `status`, `statusText`, `data` which might be a string or parsed error object) and throw a new, more informative error (e.g., `throw new Error(\`Jira API request to ${endpointPath} failed with status ${error.response?.status}: ${error.response?.statusText}. Details: ${error.response?.data}\`);`).
            *   If it's not an `AxiosError`, or if `error.response` is not available, rethrow the original error or a generic error message.
    *   [x] Add JSDoc comments explaining the function, its parameters, and what it returns (a JSON string) or throws.

3.  **Implement Function to Fetch Main Issue Information as JSON String**
    *   [x] Import `fetchJiraAPI` from `jiraUtils.ts`.
    *   [x] Create an asynchronous function `fetchJiraIssueDetailsString(issueIdOrKey: string): Promise<string>`.
    *   [x] Construct the `endpointPath` for fetching issue details: `/rest/api/3/issue/${issueIdOrKey}`.
    *   [x] Call `await fetchJiraAPI(endpointPath)` to get the issue data as a JSON string.
    *   [x] Return the resulting string.
    *   [x] Add JSDoc comments for `fetchJiraIssueDetailsString`.

4.  **Implement Function to Fetch Issue Remote Links as JSON String**
    *   [x] In the same file as `fetchJiraIssueDetailsString` (e.g., `src/jiraUtils.ts`).
    *   [x] Import `fetchJiraAPI`.
    *   [x] Create an asynchronous function `fetchJiraIssueRemoteLinksString(issueIdOrKey: string): Promise<string>`.
    *   [x] Construct the `endpointPath` for fetching remote links: `/rest/api/3/issue/${issueIdOrKey}/remotelink`.
    *   [x] Call `await fetchJiraAPI(endpointPath)` to get the remote links as a JSON string.
    *   [x] Return the resulting string.
    *   [x] Add JSDoc comments for `fetchJiraIssueRemoteLinksString`.

5.  **Implement the `fetchIssueFromJIRA` Function to Consolidate JSON String Data**
    *   [x] In the same file as the previous two functions (e.g., `src/jiraUtils.ts`).
    *   [x] Import `fetchJiraIssueDetailsString` and `fetchJiraIssueRemoteLinksString`.
    *   [x] Define an interface or type for the return structure, e.g.:
        ```typescript
        // Can be defined in jiraService.ts or a types file if you create one later
        export interface CombinedJiraJsonStrings {
          issueJsonString: string;
          remoteLinksJsonString: string;
        }
        ```
    *   [x] Create an asynchronous function `fetchIssueFromJIRA(issueIdOrKey: string): Promise<CombinedJiraJsonStrings>`.
    *   [x] Inside the function, call `const issueJson = await fetchJiraIssueDetailsString(issueIdOrKey);`.
    *   [x] Call `const remoteLinksJson = await fetchJiraIssueRemoteLinksString(issueIdOrKey);`.
    *   [x] Construct and return the `CombinedJiraJsonStrings` object:
        ```typescript
        // filepath: src/jiraUtils.ts
        // ...existing code...
        return {
          issueJsonString: issueJson,
          remoteLinksJsonString: remoteLinksJson,
        };
        // ...existing code...
        ```
    *   [x] Add JSDoc comments for `fetchIssueFromJIRA`.
    *   [x] Export `fetchIssueFromJIRA` and `CombinedJiraJsonStrings` (if defined in this file).

6.  **Integrate `fetchIssueFromJIRA` into `fetch-item` in `index.ts`**
    *   [x] Open `src/index.ts`.
    *   [x] Import the `fetchIssueFromJIRA` function and `CombinedJiraJsonStrings` type from `src/jiraUtils.js`.
    *   [x] Locate the `server.tool("fetch-item", ...)` definition.
    *   [x] **Critical Adaptation:** The current `fetch-item` tool's Zod schema is `{ azdoId: z.number() }`. Jira's `issueIdOrKey` is a string.
        *   Change the Zod schema to accept a string identifier, e.g., `{ itemId: z.string() }`.
        *   Update the tool's description to reflect it can fetch generic items or specify it now fetches Jira items.
    *   [x] Modify the `async ({ azdoId })` handler to reflect the new input, e.g., `async ({ itemId }) => {`.
    *   [x] Inside the `try` block of `fetch-item`, call the Jira fetching function:
        *   `const jiraData: CombinedJiraJsonStrings = await fetchIssueFromJIRA(itemId);`
    *   [x] Adapt the return structure of `fetch-item` to include the Jira JSON strings.
    *   [x] Ensure all necessary imports are resolved and there are no type errors.
    *   [x] Update the tool's main description (the second argument to `server.tool`) if its functionality has changed significantly (e.g., from "Get AZDO details" to "Get JIRA details" or "Get item details").
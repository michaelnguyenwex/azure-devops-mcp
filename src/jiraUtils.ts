import { string, z } from "zod";
import axios, { AxiosError } from 'axios';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JIRA_API_BASE_URL, getJiraPat } from "./configStore.js";

// Sub-task issue type ID
// This is a placeholder value and should be replaced with the actual ID from your Jira instance.
// Pull the info of a current subtask (for ex: /rest/api/3/issue/CDH-1126) - 
//The id under issuetype node is your subtask type id
// To get the actual ID, make a GET request to /rest/api/3/issuetype
export const JIRA_SUBTASK_ISSUE_TYPE_ID = "10003"; // Replace with actual ID for your Jira instance

/**
 * Interface for Jira configuration
 */
export interface JiraConfig {
  baseUrl: string;
  pat: string;
}

/**
 * Retrieves Jira configuration.
 * @returns An object containing Jira base URL and PAT.
 * @throws An error if essential configuration is missing.
 */
export function getJiraConfig(): JiraConfig {
  const baseUrl = JIRA_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("JIRA_API_BASE_URL environment variable not set or is empty.");
  }
  
  const pat = getJiraPat();
  
  return { baseUrl, pat };
}

/**
 * Makes an authenticated request to the Jira API and returns the response as a JSON string.
 * @param endpointPath - The path to append to the Jira API base URL.
 * @param method - The HTTP method to use (GET, POST, PUT, DELETE). Defaults to GET.
 * @param body - Optional body for POST/PUT requests.
 * @returns A promise that resolves to the API response as a JSON string for GET, or the response object for other methods.
 * @throws An error if the request fails or the authentication is invalid.
 */
export async function fetchJiraAPI(
  endpointPath: string, 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<string | any> {
  const jiraConfig = getJiraConfig();
  const fullUrl = `${jiraConfig.baseUrl}${endpointPath}`;

  try {
    const requestConfig = {
      method,
      url: fullUrl,
      headers: {
        'Authorization': `Basic ${jiraConfig.pat}`,
        'Accept': 'application/json',
        'Content-Type': method !== 'GET' ? 'application/json' : undefined
      },
      data: body,
      transformResponse: method === 'GET' ? (res: any) => res : undefined // Only transform GET responses
    };

    const response = await axios(requestConfig);

    return method === 'GET' ? response.data : response; // Return raw string for GET, response object for others
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      throw new Error(`Jira API ${method} request to ${endpointPath} failed with status ${axiosError.response?.status}: ${axiosError.response?.statusText}. Details: ${axiosError.response?.data}`);
    } else {
      // For non-Axios errors, rethrow the original error
      throw error;
    }
  }
}

/**
 * Fetches issue details from Jira API with specified fields.
 * @param issueIdOrKey - The ID or key of the Jira issue to fetch.
 * @param fieldsToFetch - Optional array of field names/IDs to fetch (e.g., ['project', 'customfield_10128']).
 * @returns A promise that resolves to the parsed issue details as an object.
 * @throws An error if the request fails or the issue does not exist.
 */
export async function fetchJiraIssueDetails(
  issueIdOrKey: string,
  fieldsToFetch: string[] = []
): Promise<any> {
  let endpointPath = `/rest/api/3/issue/${issueIdOrKey}`;
  
  // Add fields parameter if specified
  if (fieldsToFetch.length > 0) {
    const fieldsParam = fieldsToFetch.join(',');
    endpointPath += `?fields=${encodeURIComponent(fieldsParam)}`;
  }
  
  const response = await fetchJiraAPI(endpointPath);
  return JSON.parse(response);
}

/**
 * Fetches issue details from Jira API as a JSON string.
 * @param issueIdOrKey - The ID or key of the Jira issue to fetch.
 * @returns A promise that resolves to the issue details as a JSON string.
 * @throws An error if the request fails or the issue does not exist.
 */
export async function fetchJiraIssueDetailsString(issueIdOrKey: string): Promise<string> {
  const endpointPath = `/rest/api/3/issue/${issueIdOrKey}`;
  return await fetchJiraAPI(endpointPath, 'GET');
}

/**
 * Fetches remote links for a Jira issue as a JSON string.
 * @param issueIdOrKey - The ID or key of the Jira issue to fetch remote links for.
 * @returns A promise that resolves to the remote links as a JSON string.
 * @throws An error if the request fails or the issue does not exist.
 */
export async function fetchJiraIssueRemoteLinksString(issueIdOrKey: string): Promise<string> {
  const endpointPath = `/rest/api/3/issue/${issueIdOrKey}/remotelink`;
  return await fetchJiraAPI(endpointPath, 'GET');
}

/**
 * Interface for the combined Jira JSON strings returned by fetchIssueFromJIRA.
 */
export interface CombinedJiraJsonStrings {
  issueJsonString: string;
  remoteLinksJsonString: string;
}

/**
 * Fetches both issue details and its remote links from Jira API and consolidates them.
 * @param issueIdOrKey - The ID or key of the Jira issue to fetch.
 * @returns A promise that resolves to an object containing both issue details and remote links as JSON strings.
 * @throws An error if either request fails.
 */
export async function fetchIssueFromJIRA(issueIdOrKey: string): Promise<CombinedJiraJsonStrings> {
  const issueJson = await fetchJiraIssueDetailsString(issueIdOrKey);
  const remoteLinksJson = await fetchJiraIssueRemoteLinksString(issueIdOrKey);
  
  return {
    issueJsonString: issueJson,
    remoteLinksJsonString: remoteLinksJson,
  };
}

/**
 * Interface for a JIRA link containing text and URL
 */
export interface JIRALink {
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
): Promise<{ success: boolean; message: string; data?: any; errorDetails?: any }> {
  if (!jiraId || !links || links.length === 0) {
    return {
      success: false,
      message: "JIRA ID and at least one link are required.",
      errorDetails: { jiraId, linkCount: links?.length || 0 }
    };
  }

  try {
    // Validate URLs in links
    const invalidLinks = links.filter(link => {
      try {
        new URL(link.url);
        return false; // URL is valid
      } catch {
        return true; // URL is invalid
      }
    });

    if (invalidLinks.length > 0) {
      return {
        success: false,
        message: "One or more links contain invalid URLs",
        errorDetails: { invalidLinks }
      };
    }

    // Fetch current field content
    let currentAdf = await fetchCustomFieldAdf(jiraId);
    
    // Convert links to ADF listItems
    const newListItems = links.map(link => createAdfListItem(link.text, link.url));

    let newAdf;
    if (!currentAdf) {
      // Field is empty or doesn't exist - create new ADF doc with just our links
      newAdf = createAdfDoc(newListItems);
    } else if (!isValidAdfStructure(currentAdf)) {
      // Field exists but doesn't have the structure we expect - overwrite it
      console.warn(`customfield_13870 in issue ${jiraId} had unexpected structure. Overwriting.`);
      newAdf = createAdfDoc(newListItems);
    } else {
      // Field exists with expected structure - append new items to existing bulletList
      currentAdf.content[0].content.push(...newListItems);
      newAdf = currentAdf;
    }

    // Update the field
    const data = await updateCustomField(jiraId, newAdf);

    return {
      success: true,
      message: `Successfully added ${links.length} link(s) to JIRA issue ${jiraId}`,
      data
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Error in addItemToJIRA:`, error);
    return {
      success: false,
      message: `Failed to add links to JIRA issue ${jiraId}: ${errorMessage}`,
      errorDetails: error
    };
  }
}

/**
 * Creates an ADF paragraph node containing a single text node with a link mark.
 */
function createAdfLinkParagraph(text: string, url: string) {
  return {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: text,
        marks: [
          {
            type: "link",
            attrs: {
              href: url
            }
          }
        ]
      }
    ]
  };
}

/**
 * Creates an ADF listItem node containing a paragraph with a link.
 */
function createAdfListItem(text: string, url: string) {
  return {
    type: "listItem",
    content: [createAdfLinkParagraph(text, url)]
  };
}

/**
 * Creates a complete ADF document for customfield_13870 containing a bulletList.
 * @param listItems The list item nodes to include in the bulletList.
 * @returns A complete ADF document structure.
 */
function createAdfDoc(listItems: any[]) {
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "bulletList",
        content: listItems
      }
    ]
  };
}

/**
 * Fetches the current value of customfield_13870 from a JIRA issue.
 * If the field doesn't exist or the issue doesn't exist, appropriate errors will be thrown.
 */
async function fetchCustomFieldAdf(issueIdOrKey: string): Promise<any> {
  const issueJson = await fetchJiraIssueDetailsString(issueIdOrKey);
  const issue = JSON.parse(issueJson);
  
  // Check if the issue exists and has fields
  if (!issue || !issue.fields) {
    throw new Error(`Issue ${issueIdOrKey} not found or has no fields.`);
  }

  // Return the current ADF content of customfield_13870, or null if it doesn't exist
  return issue.fields.customfield_13870 || null;
}

/**
 * Validates the structure of an ADF doc, specifically checking that it contains a bulletList
 * at the expected location (first content item).
 */
function isValidAdfStructure(doc: any): boolean {
  return doc &&
         doc.type === "doc" &&
         Array.isArray(doc.content) &&
         doc.content[0]?.type === "bulletList" &&
         Array.isArray(doc.content[0].content);
}

/**
 * Updates the content of customfield_13870 for the specified JIRA issue.
 * @throws Error if the request fails
 */
async function updateCustomField(issueIdOrKey: string, adfContent: any): Promise<any> {
  const endpointPath = `/rest/api/3/issue/${issueIdOrKey}`;
  
  const payload = {
    fields: {
      customfield_13870: adfContent
    }
  };

  try {
    const response = await fetchJiraAPI(endpointPath, 'PUT', payload);
    return response.data;
  } catch (error) {
    throw error; // Error handling already done in fetchJiraAPI
  }
}

/**
 * Fetches all issue types from Jira.
 * This can be used to find the ID for the "Sub-task" issue type.
 * @returns A promise that resolves to an array of issue types.
 * @throws An error if the request fails.
 */
export async function getJiraIssueTypes(): Promise<any> {
  const response = await fetchJiraAPI('/rest/api/3/issuetype', 'GET');
  return JSON.parse(response);
}

/**
 * Fetches the issue type ID for sub-tasks.
 * @returns A promise that resolves to the sub-task issue type ID.
 * @throws An error if the request fails or if no sub-task issue type is found.
 */
export async function getSubtaskIssueTypeId(): Promise<string> {
  try {
    const issueTypes = await getJiraIssueTypes();
    const subtaskType = issueTypes.find((type: any) => 
      type.subtask === true || 
      type.name.toLowerCase() === 'sub-task' || 
      type.name.toLowerCase() === 'subtask'
    );
    
    if (subtaskType && subtaskType.id) {
      return subtaskType.id;
    }
    
    // Fallback to the predefined constant if no subtask type is found
    console.warn('No subtask issue type found in Jira. Using predefined ID:', JIRA_SUBTASK_ISSUE_TYPE_ID);
    return JIRA_SUBTASK_ISSUE_TYPE_ID;
  } catch (error) {
    console.error('Error fetching subtask issue type ID:', error);
    // Fallback to the predefined constant
    console.warn('Using predefined subtask issue type ID due to error:', JIRA_SUBTASK_ISSUE_TYPE_ID);
    return JIRA_SUBTASK_ISSUE_TYPE_ID;
  }
}

/**
 * Makes a POST request to create a new item in Jira.
 * @param payload - The payload to send (will be converted to JSON).
 * @returns A promise that resolves to the API response.
 * @throws An error if the request fails.
 */
export async function createJiraItem(payload: any): Promise<any> {
  const response = await fetchJiraAPI('/rest/api/3/issue', 'POST', payload);
  return response.data;
}

/**
 * Interface for the result of creating a subtask in Jira
 */
export interface SubtaskCreationResult {
  success: boolean;
  issueKey?: string;
  summary: string;
  error?: string;
}

/**
 * Creates multiple subtasks for a parent Jira issue.
 * This function fetches parent issue details first to populate fields like project, sprint, and team.
 * 
 * @param parentJiraId - The ID or key of the parent Jira issue.
 * @param subtaskSummaries - Array of strings to use as summaries for the subtasks.
 * @returns A promise that resolves to an array of results, one for each subtask creation attempt.
 * @throws Error if there are issues with the Jira configuration.
 */
export async function createJIRAsubtasks(
  parentJiraId: string,
  subtaskSummaries: string[]
): Promise<SubtaskCreationResult[]> {
  if (!parentJiraId) {
    throw new Error("Parent Jira ID is required.");
  }
  
  if (!subtaskSummaries || subtaskSummaries.length === 0) {
    throw new Error("At least one subtask summary is required.");
  }
  
  const results: SubtaskCreationResult[] = [];
  
  try {
    // Get Jira configuration (ensures we have a valid PAT and base URL)
    const jiraConfig = getJiraConfig();
    
    // Fetch parent issue details
    const fieldsToFetch = ['project', 'customfield_10128', 'customfield_10021'];
    const parentIssue = await fetchJiraIssueDetails(parentJiraId, fieldsToFetch);
    
    if (!parentIssue || !parentIssue.fields || !parentIssue.fields.project) {
      throw new Error(`Could not retrieve necessary details for parent issue ${parentJiraId}.`);
    }
    
    // Extract required values from parent issue
    const projectId = parentIssue.fields.project.id;
    const agileTeamValue = parentIssue.fields.customfield_10128;
    const sprintValue = parentIssue.fields.customfield_10021;
    
    // Get subtask issue type ID
    const subtaskIssueTypeId = await getSubtaskIssueTypeId();
    
    // Process each subtask summary
    for (const summary of subtaskSummaries) {
      try {        // Build subtask payload with fields that we know exist
        const payload: any = {
          fields: {
            summary: summary.trim(),
            project: {
              id: projectId
            },
            parent: {
              key: parentJiraId
            },
            issuetype: {
              id: subtaskIssueTypeId
            }
          }
        };
        
        // Add optional fields if available in parent using index notation to avoid TypeScript errors
        if (agileTeamValue) {
          payload.fields['customfield_10128'] = agileTeamValue;
        }
        
        if (sprintValue) {
          payload.fields['customfield_10021'] = sprintValue;
        }
        
        // Create the subtask
        const response = await createJiraItem(payload);
        
        results.push({
          success: true,
          issueKey: response.key,
          summary
        });
        
        console.log(`Successfully created subtask ${response.key} for parent ${parentJiraId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error creating subtask "${summary}" for parent ${parentJiraId}:`, error);
        
        results.push({
          success: false,
          summary,
          error: errorMessage
        });
      }
    }
    
    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error creating subtasks for parent issue ${parentJiraId}:`, error);
    
    // For global error, add a result for each subtask with the same error
    return subtaskSummaries.map(summary => ({
      success: false,
      summary,
      error: errorMessage
    }));
  }
}

/**
 * Registers a tool to create subtasks in Jira.
 * This is an MCP wrapper around the createJIRAsubtasks function.
 */
export function createJiraSubtasksTool(server: McpServer) {
  server.tool(
    "create-jira-subtasks",
    "Creates subtasks in Jira for a specified parent issue. The subtasks will inherit fields like project, agile team, and sprint from the parent issue. Requires JIRA_API_BASE_URL and JIRA_PAT environment variables to be set.",
    {
      parentJiraId: z.string().describe("The ID or key of the parent Jira issue."),
      subtaskSummaries: z.array(z.string()).describe("Array of strings to use as summaries for the subtasks.")
    },
    async (params) => {
      try {
        const { parentJiraId, subtaskSummaries } = params;
        const results = await createJIRAsubtasks(parentJiraId, subtaskSummaries);
        
        // Count successful and failed creations
        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;
        
        // Prepare detailed results for display
        const successDetails = results
          .filter(r => r.success)
          .map(r => `${r.issueKey}: ${r.summary}`);
        
        const failureDetails = results
          .filter(r => !r.success)
          .map(r => `"${r.summary}" - Error: ${r.error}`);
        
        // Construct the message
        let responseText = `Created ${successful} subtask(s) for Jira issue ${parentJiraId}`;
        if (failed > 0) {
          responseText += `, ${failed} failed`;
        }
        
        if (successful > 0) {
          responseText += "\n\nSuccessfully created subtasks:\n";
          responseText += successDetails.join("\n");
        }
        
        if (failed > 0) {
          responseText += "\n\nFailed subtasks:\n";
          responseText += failureDetails.join("\n");
        }
        
        return {
          structuredContent: {
            results: results,
            summary: {
              successful,
              failed,
              total: results.length
            }
          },
          content: [{ type: "text", text: responseText }]
        };
      } catch (error) {
        console.error('Error in create-jira-subtasks tool:', error);
        const errorMessage = `Error creating subtasks: ${error instanceof Error ? error.message : String(error)}. Ensure JIRA_API_BASE_URL and JIRA_PAT environment variables are correctly set.`;
        return {
          structuredContent: { error: errorMessage },
          content: [{ type: "text", text: errorMessage }],
          isError: true
        };
      }
    }
  );
}


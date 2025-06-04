import { string, z } from "zod";
import axios, { AxiosError } from 'axios';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JIRA_API_BASE_URL, getJiraPat } from "./configStore.js";

/**
 * Makes an authenticated GET request to the Jira API and returns the response as a JSON string.
 * @param endpointPath - The path to append to the Jira API base URL.
 * @returns A promise that resolves to the API response as a JSON string.
 * @throws An error if the request fails or the authentication is invalid.
 */
export async function fetchJiraAPI(endpointPath: string): Promise<string> {
  const fullUrl = `${JIRA_API_BASE_URL}${endpointPath}`;
  const jiraPat = getJiraPat(); // This PAT is the Base64 encoded "email:api_token" string

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        'Authorization': `Basic ${jiraPat}`,
        'Accept': 'application/json'
      },
      transformResponse: (res) => res, // Return the raw response string
    });

    return response.data; // Return the raw JSON string
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      throw new Error(`Jira API request to ${endpointPath} failed with status ${axiosError.response?.status}: ${axiosError.response?.statusText}. Details: ${axiosError.response?.data}`);
    } else {
      // For non-Axios errors, rethrow the original error
      throw error;
    }
  }
}

/**
 * Fetches issue details from Jira API as a JSON string.
 * @param issueIdOrKey - The ID or key of the Jira issue to fetch.
 * @returns A promise that resolves to the issue details as a JSON string.
 * @throws An error if the request fails or the issue does not exist.
 */
export async function fetchJiraIssueDetailsString(issueIdOrKey: string): Promise<string> {
  const endpointPath = `/rest/api/3/issue/${issueIdOrKey}`;
  return await fetchJiraAPI(endpointPath);
}

/**
 * Fetches remote links for a Jira issue as a JSON string.
 * @param issueIdOrKey - The ID or key of the Jira issue to fetch remote links for.
 * @returns A promise that resolves to the remote links as a JSON string.
 * @throws An error if the request fails or the issue does not exist.
 */
export async function fetchJiraIssueRemoteLinksString(issueIdOrKey: string): Promise<string> {
  const endpointPath = `/rest/api/3/issue/${issueIdOrKey}/remotelink`;
  return await fetchJiraAPI(endpointPath);
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
  const fullUrl = `${JIRA_API_BASE_URL}/rest/api/3/issue/${issueIdOrKey}`;
  const jiraPat = getJiraPat();

  try {
    const response = await axios.put(
      fullUrl,
      {
        fields: {
          customfield_13870: adfContent
        }
      },
      {
        headers: {
          'Authorization': `Basic ${jiraPat}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      throw new Error(`Failed to update JIRA issue ${issueIdOrKey}: ${axiosError.response?.status} ${axiosError.response?.statusText}. Details: ${JSON.stringify(axiosError.response?.data)}`);
    }
    throw error;
  }
}


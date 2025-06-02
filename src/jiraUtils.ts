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


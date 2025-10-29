import axios from 'axios';
import { getAzureDevOpsConfig } from '../configStore.js';
import { DevOpsStoryFields } from './types.js';

/**
 * Checks if required environment variables are set
 * @throws Error if any required environment variable is missing
 */
export function checkRequiredEnvVars(): void {
  const required = ['AZDO_ORG', 'AZDO_PROJECT', 'AZDO_PAT'];
  const missing: string[] = [];

  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Gets the headers required for Azure DevOps API requests
 * @returns Headers object with authorization and content type
 */
export async function getAzureDevOpsHeaders(): Promise<Record<string, string>> {
  const config = await getAzureDevOpsConfig();
  
  return {
    'Authorization': `Basic ${Buffer.from(`:${config.pat}`).toString('base64')}`,
    'Content-Type': 'application/json-patch+json'
  };
}

/**
 * Creates a work item in Azure DevOps
 * @param fields - The work item fields following DevOps API structure
 * @returns Promise resolving to the created work item response
 * @throws Error if creation fails
 */
export async function createWorkItem(fields: DevOpsStoryFields): Promise<any> {
  try {
    console.log('\n📝 Creating Azure DevOps work item...');
    
    // Check environment variables
    checkRequiredEnvVars();
    
    const config = await getAzureDevOpsConfig();
    const headers = await getAzureDevOpsHeaders();
    
    // Build the API URL
    const apiUrl = `https://dev.azure.com/${config.organization}/${config.projectName}/_apis/wit/workitems/$DevOps Story?api-version=7.0`;
    
    console.log(`📍 API URL: ${apiUrl}`);
    
    // Transform fields object into Azure DevOps PATCH operations format
    const operations = Object.entries(fields)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([fieldName, value]) => ({
        op: 'add',
        path: `/fields/${fieldName}`,
        value: value
      }));
    
    console.log(`📋 Operations count: ${operations.length}`);
    console.log(`📋 Work item title: ${fields['System.Title']}`);
    
    // Make the API request
    const response = await axios.patch(apiUrl, operations, {
      headers
    });
    
    console.log(`✅ Work item created successfully!`);
    console.log(`📌 Work Item ID: ${response.data.id}`);
    console.log(`🔗 Work Item URL: ${response.data._links?.html?.href || 'N/A'}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create work item:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 401) {
        throw new Error('Azure DevOps authentication failed. Check your PAT token.');
      } else if (status === 403) {
        throw new Error('Azure DevOps access forbidden. Check your PAT token permissions.');
      } else if (status === 404) {
        throw new Error('Azure DevOps project or work item type not found. Check organization and project name.');
      } else {
        throw new Error(`Azure DevOps API error (${status}): ${message}`);
      }
    }
    
    throw new Error(`Failed to create work item: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets all pipelines from Azure DevOps
 * @returns Promise resolving to array of pipeline objects
 * @throws Error if retrieval fails
 */
export async function getAllPipelines(): Promise<any[]> {
  try {
    console.log('\n🔍 Fetching all pipelines from Azure DevOps...');
    
    // Check environment variables
    checkRequiredEnvVars();
    
    const config = await getAzureDevOpsConfig();
    const headers = await getAzureDevOpsHeaders();
    
    // Build the API URL
    const apiUrl = `https://dev.azure.com/${config.organization}/${config.projectName}/_apis/pipelines?api-version=7.2-preview.1`;
    
    console.log(`📍 API URL: ${apiUrl}`);
    
    // Make the API request
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': headers['Authorization'],
        'Content-Type': 'application/json'
      }
    });
    
    const pipelines = response.data.value || [];
    
    console.log(`✅ Retrieved ${pipelines.length} pipelines`);
    
    return pipelines;
  } catch (error) {
    console.error('❌ Failed to get pipelines:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 401) {
        throw new Error('Azure DevOps authentication failed. Check your PAT token.');
      } else if (status === 403) {
        throw new Error('Azure DevOps access forbidden. Check your PAT token permissions.');
      } else {
        throw new Error(`Azure DevOps API error (${status}): ${message}`);
      }
    }
    
    throw new Error(`Failed to get pipelines: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


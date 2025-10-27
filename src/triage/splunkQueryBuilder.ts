/**
 * Natural Language to Splunk Processing Language (SPL) Query Builder
 * Converts user-friendly natural language queries into valid SPL queries
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';

interface FriendlyEnvironment {
  friendlyName: string;
  splunkEnv: string;
}

interface FriendlyApp {
  friendlyName: string;
  repoName: string;
  splunkAppName: string;
}

interface FriendlyRepoMapping {
  environments: FriendlyEnvironment[];
  appNames: FriendlyApp[];
}

/**
 * Reads and parses the friendly repository mapping JSON
 */
async function loadFriendlyMappings(friendlyRepoPath: string): Promise<string> {
  try {
    const content = await readFile(friendlyRepoPath, 'utf-8');
    const mappings: FriendlyRepoMapping = JSON.parse(content);
    
    // Build a structured mapping string for the AI prompt
    let mappingText = '**Environment Mappings:**\n';
    for (const env of mappings.environments) {
      mappingText += `- When user says: "${env.friendlyName}" → Use Environment="${env.splunkEnv}"\n`;
    }
    
    mappingText += '\n**Application Mappings:**\n';
    for (const app of mappings.appNames) {
      mappingText += `- When user says: "${app.friendlyName}" → Use Application="${app.splunkAppName}"\n`;
    }
    
    console.log('Loaded friendly name mappings:\n', mappingText);
    return mappingText;
  } catch (error) {
    console.error('Error loading friendly mappings:', error);
    throw new Error(`Failed to load friendly mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Reads the sample Splunk queries from markdown file
 */
async function loadSampleQueries(sampleQueriesPath: string): Promise<string> {
  try {
    const content = await readFile(sampleQueriesPath, 'utf-8');
    console.log('Loaded sample queries (first 200 chars):', content.substring(0, 200) + '...');
    return content;
  } catch (error) {
    console.error('Error loading sample queries:', error);
    throw new Error(`Failed to load sample queries: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function buildSplunkQueryFromNL(
  naturalLanguageQuery: string,
  friendlyRepoPath: string,
  sampleQueriesPath: string
): Promise<string> {
  // Load friendly name mappings
  const friendlyMappings = await loadFriendlyMappings(friendlyRepoPath);
  
  // Load sample queries
  const sampleQueries = await loadSampleQueries(sampleQueriesPath);
  
  // For now, return a mock SPL query with both mappings and samples loaded
  return `index=applogs "DUMMY QUERY"`;
}


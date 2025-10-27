/**
 * Natural Language to Splunk Processing Language (SPL) Query Builder
 * Converts user-friendly natural language queries into valid SPL queries
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { getOpenAIConfig } from '../configStore.js';

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

interface SampleQuery {
  pattern: string;
  spl: string;
}

interface QueryCategory {
  category: string;
  description: string;
  queries: SampleQuery[];
}

interface SampleQueriesData {
  description: string;
  examples: QueryCategory[];
  commonPatterns: {
    defaultIndex: string;
    errorLevels: string[];
    exceptionField: string;
    environments: string[];
    commonOperators: string[];
  };
}

/**
 * Reads the sample Splunk queries from JSON file and formats them for the AI prompt
 */
async function loadSampleQueries(sampleQueriesPath: string): Promise<string> {
  try {
    const content = await readFile(sampleQueriesPath, 'utf-8');
    const data: SampleQueriesData = JSON.parse(content);
    
    // Format the JSON into a readable prompt structure
    let formattedSamples = '**Sample Splunk Query Patterns:**\n\n';
    
    for (const category of data.examples) {
      formattedSamples += `**${category.category}** - ${category.description}\n`;
      for (const query of category.queries) {
        formattedSamples += `  Pattern: ${query.pattern}\n`;
        formattedSamples += `  SPL: ${query.spl}\n\n`;
      }
    }
    
    formattedSamples += '**Common Patterns:**\n';
    formattedSamples += `- Default Index: ${data.commonPatterns.defaultIndex}\n`;
    formattedSamples += `- Error Levels: ${data.commonPatterns.errorLevels.join(', ')}\n`;
    formattedSamples += `- Exception Field: ${data.commonPatterns.exceptionField}\n`;
    formattedSamples += `- Environments: ${data.commonPatterns.environments.join(', ')}\n`;
    formattedSamples += `- Common Operators:\n`;
    for (const op of data.commonPatterns.commonOperators) {
      formattedSamples += `  ${op}\n`;
    }
    
    console.log('Loaded sample queries from JSON (formatted for AI)');
    return formattedSamples;
  } catch (error) {
    console.error('Error loading sample queries:', error);
    throw new Error(`Failed to load sample queries: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generates an SPL query using OpenAI based on natural language input
 */
async function generateSPLWithAI(
  naturalLanguageQuery: string,
  friendlyMappings: string,
  sampleQueries: string
): Promise<string> {
  try {
    // Get OpenAI configuration
    const openAIConfig = await getOpenAIConfig();
    
    // Build the system prompt with all context
    const systemPrompt = `You are an expert Splunk SPL (Search Processing Language) query generator. Your sole purpose is to convert natural language queries into valid, executable Splunk SPL queries.

**Critical Rules:**
1. The default index is "applogs" unless the user specifies otherwise
2. Output ONLY the raw SPL query string - no explanations, no formatting, no code blocks
3. Use the friendly name mappings provided below to convert user-friendly terms to proper Splunk field values
4. Follow the patterns from the sample queries provided
5. Use proper SPL syntax including pipes (|), field names, and operators

${friendlyMappings}

**Sample Splunk Queries for Reference:**
${sampleQueries}

**Instructions:**
- Analyze the user's natural language query
- Map any friendly names (like "cip", "prod", "qa") to their proper Splunk field values
- Generate a valid SPL query that accomplishes what the user requested
- Return ONLY the SPL query string, nothing else`;

    const userPrompt = `Convert this natural language query to SPL: ${naturalLanguageQuery}`;

    console.log('🤖 Calling OpenAI to generate SPL query...');

    // Call OpenAI API
    const response = await fetch(`${openAIConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'azure-gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from OpenAI API');
    }

    const generatedSPL = data.choices[0].message.content.trim();
    
    // Clean up the response - remove any markdown code blocks if present
    let cleanedSPL = generatedSPL
      .replace(/```spl\n?/g, '')
      .replace(/```splunk\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    console.log('✅ Generated SPL query:', cleanedSPL);
    
    return cleanedSPL;
  } catch (error) {
    console.error('❌ Failed to generate SPL with OpenAI:', error);
    throw new Error(`Failed to generate SPL query: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  
  // Generate SPL query using OpenAI
  const splQuery = await generateSPLWithAI(naturalLanguageQuery, friendlyMappings, sampleQueries);
  
  return splQuery;
}


#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import 'dotenv/config'
import axios from 'axios';
import {
    addTestCaseToTestSuiteTool,
    updateAutomatedTestTool,
    registerTestCaseTool,
    copyTestCasesToTestSuiteTool,
    addTestcasesToJIRATool,
    getTestCasesFromTestSuiteTool,
    getChildTestSuitesTool
} from './testCaseUtils.js';
import { getAzureDevOpsConfig } from './configStore.js'; // Import the global config function
import { 
    fetchIssueFromJIRA, 
    CombinedJiraJsonStrings,
    createJiraSubtasksTool // Added import for Jira subtasks tool
} from './jiraUtils.js'; // Import Jira functionality
import {
  searchSplunkTool,
  searchSplunkAITool,
  getNextSplunkResultsTool
} from './integrations/splunk/tools/index.js';
import { initializeSplunkClient } from './integrations/splunk/client.js';
import { getSplunkConfig } from './configStore.js';
import { triageSplunkErrorTool } from './triage/triageTool.js';
import { createDevOpsStory } from './devops/create-devops.js';

// Initialize Splunk client if configured
try {
  const splunkConfig = await getSplunkConfig();
  initializeSplunkClient(splunkConfig);
  console.log('✅ Splunk client initialized');
} catch (error) {
  console.log('ℹ️  Splunk not configured (optional):', error instanceof Error ? error.message : 'Unknown error');
}

// Create an MCP server
const server = new McpServer({
  name: "WexAZDO",
  version: "1.0.0"
});


server.tool(
    "fetch-item",
     "Get details for an item from AZDO or Jira",
  { itemId: z.string() },
  async ({ itemId }) => {
    try {
      // Check if the itemId is numeric (AZDO) or string-based (Jira)
      const isNumeric = /^\d+$/.test(itemId);
      
      if (isNumeric) {
        // Handle as AZDO item
        const azdoId = parseInt(itemId, 10);
        const { organization, projectName, pat } = await getAzureDevOpsConfig();
        const apiUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/${azdoId}?api-version=7.1-preview.3&$expand=relations`;
        
        const response = await axios.get(apiUrl, {
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
          }
        });
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(response.data, null, 2)
          }]
        };
      } else {
        // Handle as Jira item
        const jiraData = await fetchIssueFromJIRA(itemId);
        
        return {
          content: [{ 
            type: "text", 
            text: `Jira Issue Details: ${jiraData.issueJsonString}\n\nJira Remote Links: ${jiraData.remoteLinksJsonString}`
          }]
        };
      }
    } catch (error) {
      console.error('Error fetching item:', error);
      
      return {
        content: [{ 
          type: "text", 
          text: `Error fetching item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

// Register tools from testCaseUtils.ts
registerTestCaseTool(server);
addTestCaseToTestSuiteTool(server);
updateAutomatedTestTool(server);
copyTestCasesToTestSuiteTool(server);
addTestcasesToJIRATool(server);
getTestCasesFromTestSuiteTool(server);
getChildTestSuitesTool(server); // Register the child test suites tool

// Register tools from jiraUtils.ts
createJiraSubtasksTool(server); // Register the Jira subtasks tool

// Register Splunk tools
searchSplunkTool(server);
searchSplunkAITool(server);
getNextSplunkResultsTool(server);

// Register Triage tools
triageSplunkErrorTool(server);

// Register DevOps tools
server.tool(
  "create-devops",
  "Create Azure DevOps story from GitHub PR for feature flags or pipeline operations",
  { 
    userRequest: z.string().describe("Natural language request like 'create ff [PR_URL]' or 'remove ff [PR_URL]' or 'run pipeline [PR_URL]'")
  },
  async ({ userRequest }) => {
    try {
      console.log(`\n🚀 create-devops tool invoked with request: ${userRequest}`);
      
      const workItem = await createDevOpsStory(userRequest);
      
      const workItemUrl = workItem._links?.html?.href || 'N/A';
      const successMessage = `✅ Azure DevOps Story Created Successfully!

📌 Work Item ID: ${workItem.id}
📋 Title: ${workItem.fields?.['System.Title'] || 'N/A'}
🔗 URL: ${workItemUrl}

The DevOps story has been created and is ready for review in Azure DevOps.`;
      
      return {
        content: [{ 
          type: "text", 
          text: successMessage
        }]
      };
    } catch (error) {
      console.error('❌ Error in create-devops tool:', error);
      
      const errorMessage = `❌ Failed to create Azure DevOps story

Error: ${error instanceof Error ? error.message : 'Unknown error'}

Troubleshooting:
- Ensure the PR URL is valid and accessible
- Check that the PR contains feature flag or deployment information
- Verify environment variables are set (AZDO_PAT, AZDO_ORG, AZDO_PROJECT, OPENAI_API_KEY, GITHUB_TOKEN)
- For Pipeline mode, ensure the pipeline exists in Azure DevOps`;
      
      return {
        content: [{ 
          type: "text", 
          text: errorMessage
        }]
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
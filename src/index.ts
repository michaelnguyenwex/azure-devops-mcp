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

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
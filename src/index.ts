#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import 'dotenv/config'
import axios from 'axios';
import {
    addTestCaseToTestSuiteTool, // Renamed import
    updateAutomatedTestTool, // Renamed import
    registerTestCaseTool, // Renamed import
    createStaticTestSuiteTool, // Renamed import
    copyTestCasesToTestSuiteTool // Added import for the new tool
} from './testCaseUtils.js';
import { getAzureDevOpsConfig } from './configStore.js'; // Import the global config function

// Create an MCP server
const server = new McpServer({
  name: "WexAZDO",
  version: "1.0.0"
});


server.tool(
    "fetch-item",
     "Get AZDO details for an item",
  { azdoId: z.number()},
  async ({ azdoId }) => {
    try {
      const { organization, projectName, pat } = await getAzureDevOpsConfig(); // Get config, including pat
      const apiUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/wit/workitems/${azdoId}?api-version=7.1-preview.3&$expand=relations`;
      
      // const pat = process.env.AZDO_PAT; // Removed direct access, pat is from getAzureDevOpsConfig
      // if (!pat) { // This check is now handled by getAzureDevOpsConfig
      //   throw new Error('Azure DevOps Personal Access Token not found in .env file');
      // }    
      
      // Make the API call with authorization header
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Return the response data
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error fetching data from Azure DevOps:', error);
      
      return {
        content: [{ 
          type: "text", 
          text: `Error fetching work item ${azdoId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

// Register tools from testCaseUtils.ts
registerTestCaseTool(server); // Renamed function call
addTestCaseToTestSuiteTool(server); // Renamed function call
updateAutomatedTestTool(server); // Renamed function call
createStaticTestSuiteTool(server); // Renamed function call
copyTestCasesToTestSuiteTool(server); // Register the new tool

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
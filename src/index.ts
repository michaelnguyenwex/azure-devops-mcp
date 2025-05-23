import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import 'dotenv/config'
import axios from 'axios';
import { registerCreateTestCaseTool, registerUpdateAutomatedTestTool } from './testCaseUtils.js';

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
      const apiUrl = `https://dev.azure.com/WexHealthTech/Health/_apis/wit/workitems/${azdoId}?api-version=7.1-preview.3&$expand=relations`;
      
      // Get the Personal Access Token from .env file
      const pat = process.env.AZDO_PAT;
      if (!pat) {
        throw new Error('Azure DevOps Personal Access Token not found in .env file');
      }    
      
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

//Register the create-test-case tool
registerCreateTestCaseTool(server);

// Register the update-automated-test tool
registerUpdateAutomatedTestTool(server);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
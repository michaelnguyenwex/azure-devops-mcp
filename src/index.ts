import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import 'dotenv/config'
import axios from 'axios';

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

server.tool(
    "create-test-case",
     "Creates a new Test Case work item in Azure DevOps.",
  { 
    title: z.string().describe("The title of the test case."),
    areaPath: z.string().describe("The Area Path for the test case (e.g., 'MyProject\\Area\\Feature')."),
    iterationPath: z.string().describe("The Iteration Path for the test case (e.g., 'MyProject\\Sprint 1')."),
    steps: z.string().describe("XML string representing the test steps for Microsoft.VSTS.TCM.Steps."), // XML string for Microsoft.VSTS.TCM.Steps
    priority: z.number().optional().default(2).describe("Priority of the test case (1=High, 2=Medium, 3=Low, 4=Very Low). Defaults to 2."),
    assignedTo: z.string().optional().describe("The unique name or email of the user to assign the test case to (e.g., 'user@example.com'). Optional."),
    state: z.string().optional().default("Design").describe("The initial state of the test case (e.g., 'Design', 'Ready'). Defaults to 'Design'."),
    reason: z.string().optional().default("New").describe("The reason for the initial state (e.g., 'New', 'Test Case created'). Defaults to 'New'."),
    automationStatus: z.string().optional().default("Not Automated").describe("The automation status of the test case (e.g., 'Not Automated', 'Automated', 'Planned'). Defaults to 'Not Automated'.")
  },
  async ({ title, areaPath, iterationPath, steps, priority, assignedTo, state, reason, automationStatus }) => {
    try {
      const apiUrl = `https://dev.azure.com/WexHealthTech/Health/_apis/wit/workitems/$Test%20Case?api-version=7.1-preview.3`;
      
      // Get the Personal Access Token from .env file
      const pat = process.env.AZDO_PAT;
      if (!pat) {
        throw new Error('Azure DevOps Personal Access Token not found in .env file');
      }    
      
      // Prepare the request body
      const requestBody = [
        {
          "op": "add",
          "path": "/fields/System.Title",
          "value": title
        },
        {
          "op": "add",
          "path": "/fields/System.AreaPath",
          "value": areaPath
        },
        {
          "op": "add",
          "path": "/fields/System.IterationPath",
          "value": iterationPath
        },
        {
          "op": "add",
          "path": "/fields/Microsoft.VSTS.TCM.Steps",
          "value": steps
        },
        {
          "op": "add",
          "path": "/fields/Microsoft.VSTS.Common.Priority",
          "value": priority
        },
        // System.State and System.Reason are usually set based on workflow
        // For a new test case, "Design" state and "New" reason are common defaults
        {
          "op": "add",
          "path": "/fields/System.State",
          "value": state
        },
        {
          "op": "add",
          "path": "/fields/System.Reason",
          "value": reason
        },
        {
          "op": "add",
          "path": "/fields/Microsoft.VSTS.TCM.AutomationStatus", // Corrected field name
          "value": automationStatus
        }
      ];

      if (assignedTo) {
        requestBody.push({
          "op": "add",
          "path": "/fields/System.AssignedTo",
          "value": assignedTo
        });
      }
      
      // Make the API call with authorization header
      const response = await axios.post(apiUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json-patch+json'
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
      console.error('Error creating test case in Azure DevOps:', error);
      
      return {
        content: [{ 
          type: "text", 
          text: `Error creating test case: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
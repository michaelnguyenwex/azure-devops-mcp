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

} from './integrations/splunk/tools/index.js';
import { initializeSplunkClient } from './integrations/splunk/client.js';
import { getSplunkConfig } from './configStore.js';
import { runTriage, validateTriageInput, TriageConfig } from './triage/triageWorkflow.js';
import { SplunkLogEvent } from './triage/types.js';

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

/**
 * Triage Splunk Error Tool
 * 
 * Automatically analyzes production errors from Splunk logs, identifies potential root causes
 * by cross-referencing with recent GitHub commits, and creates detailed Jira tickets.
 * 
 * This tool performs the following steps:
 * 1. Groups error logs by normalized error signatures to avoid duplicate analysis
 * 2. Checks if each error signature has already been processed (prevents duplicate tickets)
 * 3. Retrieves deployment information to understand what version was running when the error occurred
 * 4. Fetches recent GitHub commits and analyzes them for potential relationships to the error
 * 5. Creates comprehensive Jira tickets with error details, Splunk links, and suspected commits
 * 6. Tracks processed errors to prevent future duplicate ticket creation
 */
server.tool(
  "triage_splunk_error",
  "Automatically analyze production errors from Splunk and create detailed Jira triage tickets with suspected root causes",
  {
    logs: z.array(z.object({
      _time: z.string().describe("Timestamp of the log event (ISO format)"),
      message: z.string().describe("The error message content"),
      source: z.string().optional().describe("Source system that generated the error"),
      serviceName: z.string().optional().describe("Name of the service that generated the error"),
      environment: z.string().optional().describe("Environment where the error occurred (prod, staging, etc.)"),
      level: z.string().optional().describe("Log level (ERROR, WARN, etc.)"),
    }).passthrough()).describe("Array of Splunk log events to analyze for triage"),
    
    config: z.object({
      repositoryName: z.string().optional().describe("GitHub repository name in format 'owner/repo' (e.g., 'company/service-repo')"),
      jiraProjectKey: z.string().optional().describe("Jira project key for creating tickets (e.g., 'PROD', 'OPS')"),
      commitLookbackDays: z.number().min(1).max(30).optional().describe("Number of days to look back for commits (1-30, default: 7)"),
      splunkBaseUrl: z.string().optional().describe("Base URL for Splunk instance to create investigation links"),
      createTickets: z.boolean().optional().describe("Whether to actually create Jira tickets (false for dry-run mode, default: true)")
    }).optional().describe("Optional configuration for the triage process")
  },
  async ({ logs, config }) => {
    try {
      console.log(`\n🔍 Starting automated error triage for ${logs.length} log events`);
      
      // Validate input parameters
      const triageConfig: TriageConfig = config || {};
      validateTriageInput(logs as SplunkLogEvent[], triageConfig);
      
      console.log('✅ Input validation passed');
      console.log('📊 Triage configuration:', {
        repositoryName: triageConfig.repositoryName || 'default',
        jiraProjectKey: triageConfig.jiraProjectKey || 'PROD',
        commitLookbackDays: triageConfig.commitLookbackDays || 7,
        createTickets: triageConfig.createTickets !== false,
        dryRun: triageConfig.createTickets === false
      });
      
      // Run the triage workflow
      await runTriage(logs as SplunkLogEvent[], triageConfig);
      
      return {
        content: [{
          type: "text",
          text: `✅ Triage analysis completed successfully!\n\nProcessed ${logs.length} log events for automated error analysis and Jira ticket creation. Check the console output above for detailed results including:\n\n• Number of unique error signatures identified\n• Jira tickets created for new errors\n• Errors skipped (already processed)\n• GitHub commits analyzed for potential root causes\n\nThe triage system helps reduce manual debugging effort by automatically:\n1. 🔍 Identifying and grouping similar errors\n2. 🚀 Finding deployment information for error context  \n3. 💻 Analyzing recent commits for suspected causes\n4. 🎫 Creating detailed Jira tickets with investigation starting points\n5. 📋 Preventing duplicate tickets for known issues`
        }]
      };
      
    } catch (error) {
      console.error('❌ Triage analysis failed:', error);
      
      return {
        content: [{
          type: "text", 
          text: `❌ Error triage failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nThis could be due to:\n• Invalid log event format (missing _time or message fields)\n• Configuration issues (invalid repository name, etc.)\n• Service connectivity problems (Splunk, GitHub, Jira)\n• Insufficient permissions for required operations\n\nPlease check the error details above and verify your configuration.`
        }]
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTriage, validateTriageInput, TriageConfig } from './triageWorkflow.js';
import { SplunkLogEvent } from './types.js';

/**
 * Registers the triage Splunk error tool with the MCP server.
 * 
 * This tool automatically analyzes production errors from Splunk logs, identifies potential root causes
 * by cross-referencing with recent GitHub commits, and creates detailed Jira tickets.
 * 
 * @param server - The MCP server instance to register the tool with
 */
export function triageSplunkErrorTool(server: McpServer) {
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
          dryRun: triageConfig.createTickets === false,
          splunkAutoDetected: true // Splunk URL now auto-detected from existing config
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
}

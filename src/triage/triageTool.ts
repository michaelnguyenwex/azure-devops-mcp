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
    "Automatically analyze production errors and create detailed Jira triage tickets with suspected root causes from GitHub commit analysis",
    {
      errorMessages: z.array(z.string()).describe("Array of error messages to analyze for triage"),
      repositoryName: z.string().optional().describe("GitHub repository name in format 'owner/repo' (e.g., 'company/service-repo')"),
      commitLookbackDays: z.number().min(1).max(30).optional().describe("Number of days to look back for commits (1-30, default: 7)"),
      createTickets: z.boolean().optional().describe("Whether to actually create Jira tickets (false for dry-run mode, default: true)")
    },
    async ({ errorMessages, repositoryName, commitLookbackDays, createTickets }) => {
      try {
        console.log(`\n🔍 Starting automated error triage for ${errorMessages.length} error messages`);
        
        // Convert simple error messages to SplunkLogEvent format for internal processing
        const currentTime = new Date().toISOString();
        const logs: SplunkLogEvent[] = errorMessages.map((message, index) => ({
          _time: currentTime,
          message: message,
          source: 'triage-tool',
          serviceName: 'unknown-service',
          environment: 'unknown-environment',
          level: 'ERROR'
        }));
        
        // Set configuration with defaults
        const finalConfig: TriageConfig = {
          repositoryName: repositoryName || undefined,
          commitLookbackDays: commitLookbackDays || 7,
          createTickets: createTickets !== false
        };

        // Validate input
        validateTriageInput(logs, finalConfig);
        
        console.log('✅ Input validation passed');
        console.log('📊 Triage configuration:', {
          errorCount: errorMessages.length,
          repositoryName: finalConfig.repositoryName || 'not specified',
          commitLookbackDays: finalConfig.commitLookbackDays,
          createTickets: finalConfig.createTickets,
          dryRun: !finalConfig.createTickets
        });
        
        // Run the triage workflow
        await runTriage(logs, finalConfig);
        
        return {
          content: [{
            type: "text",
            text: `✅ Triage analysis completed successfully!\n\nProcessed ${errorMessages.length} error messages for automated analysis and Jira ticket creation. Check the console output above for detailed results including:\n\n• Number of unique error signatures identified\n• Jira tickets created for new errors\n• Errors skipped (already processed)\n• GitHub commits analyzed for potential root causes\n\nThe triage system helps reduce manual debugging effort by automatically:\n1. 🔍 Identifying and grouping similar errors\n2. 💻 Analyzing recent commits for suspected causes\n3. 🎫 Creating detailed Jira tickets with investigation starting points\n4. 📋 Preventing duplicate tickets for known issues`
          }]
        };
        
      } catch (error) {
        console.error('❌ Triage analysis failed:', error);
        
        return {
          content: [{
            type: "text", 
            text: `❌ Error triage failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nThis could be due to:\n• Empty or invalid error messages\n• Configuration issues (invalid repository name format)\n• Service connectivity problems (GitHub, Jira)\n• Insufficient permissions for required operations\n\nPlease check the error details above and verify your configuration.`
          }]
        };
      }
    }
  );
}

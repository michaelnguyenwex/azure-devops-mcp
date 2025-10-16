import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTriage, validateTriageInput, TriageConfig } from './triageWorkflow.js';
import { SplunkLogEvent } from './types.js';

/**
 * Registers the triage Splunk error tool with the MCP server.
 * 
 * This tool automatically analyzes production errors, identifies potential root causes
 * by cross-referencing with recent GitHub commits, and provides detailed investigation insights.
 * This is an analysis-only tool that does not create tickets.
 * 
 * @param server - The MCP server instance to register the tool with
 */
export function triageSplunkErrorTool(server: McpServer) {
  server.tool(
    "triage_splunk_error",
    "Automatically analyze production errors and identify suspected root causes through GitHub commit analysis",
    {
      errorMessages: z.string().describe("Error messages to analyze for triage"),
      repositoryName: z.string().describe("GitHub repository name in format 'owner/repo' (e.g., 'company/service-repo')"),
      commitLookbackDays: z.number().min(1).max(30).optional().describe("Number of days to look back for commits (1-30, default: 7)")
    },
    async ({ errorMessages, repositoryName, commitLookbackDays }) => {
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
          createTickets: false // Always run in dry-run mode for triage analysis
        };

        // Validate input
        validateTriageInput(logs, finalConfig);
        
        console.log('✅ Input validation passed');
        console.log('📊 Triage configuration:', {
          errorCount: errorMessages.length,
          repositoryName: finalConfig.repositoryName || 'not specified',
          commitLookbackDays: finalConfig.commitLookbackDays,
          mode: 'analysis-only (no tickets created)'
        });
        
        // Run the triage workflow
        await runTriage(logs, finalConfig);
        
        return {
          content: [{
            type: "text",
            text: `✅ Triage analysis completed successfully!\n\nProcessed ${errorMessages.length} error messages for automated analysis. Check the console output above for detailed results including:\n\n• Number of unique error signatures identified\n• Errors grouped by similarity\n• GitHub commits analyzed for potential root causes\n• Suspected commits identified for investigation\n\nThe triage analysis provides:\n1. 🔍 Error signature generation and grouping\n2. 💻 GitHub commit correlation analysis\n3. 📊 Detailed investigation starting points\n4. 🎯 Root cause suggestions based on recent changes\n\nThis analysis can be used to manually create Jira tickets or for further investigation.`
          }]
        };
        
      } catch (error) {
        console.error('❌ Triage analysis failed:', error);
        
        return {
          content: [{
            type: "text", 
            text: `❌ Error triage analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nThis could be due to:\n• Empty or invalid error messages\n• Configuration issues (invalid repository name format)\n• Service connectivity problems (GitHub)\n• Insufficient permissions for GitHub repository access\n\nPlease check the error details above and verify your configuration.`
          }]
        };
      }
    }
  );
}

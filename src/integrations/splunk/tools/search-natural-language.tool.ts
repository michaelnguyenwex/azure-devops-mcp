import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildSplunkQueryFromNL } from '../../../triage/splunkQueryBuilder.js';
import { resolve } from 'path';

export function searchSplunkAITool(server: McpServer) {
  server.tool(
    "search_splunk_ai",
    "Execute a Splunk search query using natural language.",
    {
      query: z.string().describe("The search query in plain English (e.g., 'show me errors for the consumer portal in prod')"),
      earliest_time: z.string().optional().default("-24h").describe("Start time for the Splunk search (e.g., -24h, -7d, 2024-01-01T00:00:00)"),
      latest_time: z.string().optional().default("now").describe("End time for the Splunk search")
    },
    async ({ query, earliest_time, latest_time }) => {
      try {
        console.log('🔍 Natural Language Query:', query);
        console.log('⏰ Time Range:', earliest_time, 'to', latest_time);
        
        // Build file paths for configuration files
        const friendlyRepoPath = resolve(process.cwd(), 'src/integrations/splunk/friendlyRepo.json');
        const sampleQueriesPath = resolve(process.cwd(), 'instructions/sample-splunk-queries.md');
        
        // Convert natural language to SPL using AI
        const splQuery = await buildSplunkQueryFromNL(query, friendlyRepoPath, sampleQueriesPath);
        
        console.log('✅ Generated SPL Query:', splQuery);
        
        return {
          content: [{
            type: "text",
            text: `**Natural Language Query:** ${query}\n\n**Generated SPL Query:**\n\`\`\`\n${splQuery}\n\`\`\`\n\n**Time Range:** ${earliest_time} to ${latest_time}\n\n*Note: This is the generated query. Actual Splunk search execution will be implemented in the next step.*`
          }]
        };
      } catch (error) {
        console.error('❌ Error generating SPL query:', error);
        return {
          content: [{
            type: "text",
            text: `Error generating SPL query: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );
}


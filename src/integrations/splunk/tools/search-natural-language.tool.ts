import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildSplunkQueryFromNL } from '../../../triage/splunkQueryBuilder.js';
import { getSplunkClient } from '../client.js';
import { sessionManager } from '../splunkSession.js';
import { resolve } from 'path';

export function searchSplunkAITool(server: McpServer) {
  server.tool(
    "search_splunk",
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
        const sampleQueriesPath = resolve(process.cwd(), 'src/integrations/splunk/sampleQueries.json');
        
        // Convert natural language to SPL using AI
        const splQuery = await buildSplunkQueryFromNL(query, friendlyRepoPath, sampleQueriesPath);
        
        console.log('✅ Generated SPL Query:', splQuery);
        
        // Get Splunk client and create search job
        const client = getSplunkClient();
        console.log('🔄 Creating Splunk search job...');
        
        const jobResponse = await client.search.createJob(splQuery, earliest_time || '-24h', latest_time || 'now');
        const sid = jobResponse.sid;
        
        console.log('✅ Search job created with SID:', sid);
        
        // Fetch first page of results (25 items)
        const resultsResponse = await client.search.getJobResults(sid, 25, 0);
        const results = resultsResponse.results || [];
        
        console.log(`📊 Retrieved ${results.length} results`);
        
        // Store job in session for pagination
        sessionManager.setJob(sid, results.length, splQuery, earliest_time || '-24h', latest_time || 'now');
        
        // Format results
        let output = `**Natural Language Query:** ${query}\n\n`;
        output += `**Generated SPL Query:**\n\`\`\`\n${splQuery}\n\`\`\`\n\n`;
        output += `**Time Range:** ${earliest_time} to ${latest_time}\n\n`;
        output += `**Results (showing ${results.length} items):**\n\n`;
        
        if (results.length === 0) {
          output += '*No results found.*\n';
        } else {
          output += JSON.stringify(results, null, 2);
          
          // Check if there might be more results
          if (results.length === 25) {
            output += `\n\n---\n**More results may be available.** Type 'next' or use the \`get_next_splunk_results\` tool to see the next page.`;
          }
        }
        
        return {
          content: [{
            type: "text",
            text: output
          }]
        };
      } catch (error) {
        console.error('❌ Error executing Splunk search:', error);
        return {
          content: [{
            type: "text",
            text: `Error executing Splunk search: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );
}


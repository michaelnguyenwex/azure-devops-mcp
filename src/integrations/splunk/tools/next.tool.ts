import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSplunkClient } from '../client.js';
import { sessionManager } from '../splunkSession.js';

export function getNextSplunkResultsTool(server: McpServer) {
  server.tool(
    "get_next_splunk_results",
    "Retrieves the next page of results from the previous Splunk search.",
    {},
    async () => {
      try {
        // Check if there's an active job
        if (!sessionManager.hasActiveJob()) {
          return {
            content: [{
              type: "text",
              text: "❌ No active search found. Please perform a search first using the `search_splunk_ai` tool."
            }]
          };
        }

        const jobState = sessionManager.getJob();
        if (!jobState) {
          return {
            content: [{
              type: "text",
              text: "❌ No active search found. Please perform a search first using the `search_splunk_ai` tool."
            }]
          };
        }

        // Calculate new offset
        const newOffset = jobState.offset + 25;
        
        console.log(`📄 Fetching next page: offset=${newOffset}, SID=${jobState.sid}`);
        
        // Get Splunk client and fetch next page
        const client = getSplunkClient();
        const resultsResponse = await client.search.getJobResults(jobState.sid, 25, newOffset);
        const results = resultsResponse.results || [];
        
        console.log(`📊 Retrieved ${results.length} results`);
        
        // Update offset in session
        sessionManager.setOffset(newOffset);
        
        // Format results
        let output = `**Next Page of Results (offset: ${newOffset}):**\n\n`;
        output += `**Original Query:** ${jobState.query}\n`;
        output += `**Time Range:** ${jobState.earliestTime} to ${jobState.latestTime}\n\n`;
        output += `**Results (showing ${results.length} items):**\n\n`;
        
        if (results.length === 0) {
          output += '*No more results available.*\n';
        } else {
          output += JSON.stringify(results, null, 2);
          
          // Check if there might be more results
          if (results.length === 25) {
            output += `\n\n---\n**More results may be available.** Use the \`get_next_splunk_results\` tool again to see the next page.`;
          } else {
            output += `\n\n---\n**End of results.** Retrieved ${results.length} items on this page.`;
          }
        }
        
        return {
          content: [{
            type: "text",
            text: output
          }]
        };
      } catch (error) {
        console.error('❌ Error fetching next page:', error);
        return {
          content: [{
            type: "text",
            text: `Error fetching next page: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );
}


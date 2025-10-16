import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSplunkClient } from '../client.js';

export function searchSplunkTool(server: McpServer) {
  server.tool(
    "search_splunk",
    "Execute a Splunk search query using SPL (Search Processing Language). Searches through Splunk indexes for logs, metrics, and machine data.",
    {
      search_query: z.string().describe("The Splunk SPL query to execute against Splunk data"),
      earliest_time: z.string().optional().default("-24h").describe("Start time for the Splunk search (e.g., -24h, -7d, 2024-01-01T00:00:00)"),
      latest_time: z.string().optional().default("now").describe("End time for the Splunk search"),
      max_results: z.number().optional().default(20).describe("Maximum number of Splunk events to return")
    },
    async ({ search_query, earliest_time, latest_time, max_results }) => {
      const client = getSplunkClient();
      
      const results = await client.search.execute(search_query, {
        earliestTime: earliest_time || '-24h',
        latestTime: latest_time || 'now',
        maxResults: max_results || 100
      });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results.results, null, 2)
        }]
      };
    }
  );
}
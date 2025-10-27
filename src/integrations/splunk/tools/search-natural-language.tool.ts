import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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
      console.log('Natural Language Query:', query);
      console.log('Time Range:', earliest_time, 'to', latest_time);
      
      return {
        content: [{
          type: "text",
          text: `Mock success: Received natural language query "${query}" with time range ${earliest_time} to ${latest_time}`
        }]
      };
    }
  );
}


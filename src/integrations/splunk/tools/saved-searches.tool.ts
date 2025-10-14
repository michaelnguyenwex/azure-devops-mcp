import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSplunkClient } from '../client.js';

export function listSavedSearchesTool(server: McpServer) {
  server.tool(
    "list_saved_searches",
    "List all saved searches in the connected Splunk Enterprise/Cloud instance. Returns Splunk reports, alerts, and scheduled searches with their SPL queries.",
    {},
    async () => {
      const client = getSplunkClient();
      const savedSearches = await client.savedSearches.list();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(savedSearches, null, 2)
        }]
      };
    }
  );
}
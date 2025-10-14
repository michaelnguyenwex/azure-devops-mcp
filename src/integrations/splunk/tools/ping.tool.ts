import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function splunkPingTool(server: McpServer) {
  server.tool(
    "splunk_ping",
    "Simple ping endpoint to check Splunk MCP server availability and connectivity",
    {},
    async () => {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: 'ok',
            service: 'splunk',
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    }
  );
}
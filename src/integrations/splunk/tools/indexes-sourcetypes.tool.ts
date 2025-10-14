import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSplunkClient } from '../client.js';

export function getIndexesAndSourcetypesTool(server: McpServer) {
  server.tool(
    "get_indexes_and_sourcetypes",
    "Get a comprehensive list of all Splunk indexes and their sourcetypes from this Splunk instance. Performs a Splunk search to analyze data structure and organization.",
    {},
    async () => {
      const client = getSplunkClient();
      
      const query = `
        | tstats count WHERE index=* BY index, sourcetype
        | stats count BY index, sourcetype
        | sort - count
      `;
      
      const results = await client.search.execute(query, {
        earliestTime: '-24h',
        latestTime: 'now',
        maxResults: 10000
      });
      
      const sourcetypesByIndex: Record<string, Array<{
        sourcetype: string;
        count: string;
      }>> = {};
      
      const indexes = new Set<string>();
      
      for (const result of results.results) {
        const index = result.index || '';
        const sourcetype = result.sourcetype || '';
        const count = result.count || '0';
        
        indexes.add(index);
        
        if (!sourcetypesByIndex[index]) {
          sourcetypesByIndex[index] = [];
        }
        
        sourcetypesByIndex[index].push({ sourcetype, count });
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            indexes: Array.from(indexes),
            sourcetypes: sourcetypesByIndex,
            metadata: {
              totalIndexes: indexes.size,
              totalSourcetypes: results.results.length,
              searchTimeRange: '24 hours'
            }
          }, null, 2)
        }]
      };
    }
  );
}
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setAzureDevOpsConfig } from "./configStore.js";

// 2.1: Define Zod schema for register-azure-project tool
const RegisterAzureProjectSchema = z.object({
  organization: z.string().describe("The Azure DevOps organization name (e.g., 'WexHealthTech')."),
  projectName: z.string().describe("The Azure DevOps project name (e.g., 'Health').")
});

/**
 * Registers the 'register-azure-project' tool with the MCP server.
 * This tool sets the global Azure DevOps organization and project name for subsequent tool calls.
 */
export function registerRegisterAzureProjectTool(server: McpServer) {
  server.tool(
    "register-azure-project",
    "Sets the global Azure DevOps organization and project name for subsequent tool calls.",
    RegisterAzureProjectSchema.shape,
    async (params: z.infer<typeof RegisterAzureProjectSchema>) => {
      try {
        await setAzureDevOpsConfig({
          organization: params.organization,
          projectName: params.projectName,
        });
        return {
          content: [{
            type: "text",
            text: `Azure DevOps configuration set successfully to Organization: ${params.organization}, Project: ${params.projectName}`
          }]
        };
      } catch (error) {
        console.error('Error setting Azure DevOps configuration:', error);
        return {
          content: [{
            type: "text",
            text: `Error setting Azure DevOps configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );
}

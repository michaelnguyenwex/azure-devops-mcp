import { z } from "zod";

// Zod schema for configuration validation (can still be useful for other contexts if needed)
export const AzureDevOpsConfigSchema = z.object({
  organization: z.string().min(1, "Organization name cannot be empty."),
  projectName: z.string().min(1, "Project name cannot be empty."),
  pat: z.string().min(1, "Personal Access Token (PAT) cannot be empty."), // Added PAT
});

export type AzureDevOpsConfig = z.infer<typeof AzureDevOpsConfigSchema>;

// Jira API base URL
export const JIRA_API_BASE_URL = process.env.JIRA_API_BASE_URL;

/**
 * Retrieves the Jira Personal Access Token from environment variables.
 * @returns The Jira PAT which is expected to be Base64 encoded "email:api_token" string.
 * @throws An error if the environment variable JIRA_PAT is not set or is empty.
 */
export function getJiraPat(): string {
  const pat = process.env.JIRA_PAT;
  if (!pat) {
    throw new Error("JIRA_PAT environment variable not set. Please ensure it is configured in your .env file or system environment.");
  }
  return pat;
}

/**
 * Retrieves the Azure DevOps organization, project name, and PAT from environment variables.
 * @returns A promise that resolves to the AzureDevOpsConfig object.
 * @throws An error if the environment variables AZDO_ORG, AZDO_PROJECT, or AZDO_PAT are not set or are empty.
 */
export async function getAzureDevOpsConfig(): Promise<AzureDevOpsConfig> {
  const organization = process.env.AZDO_ORG;
  const projectName = process.env.AZDO_PROJECT;
  const pat = process.env.AZDO_PAT; // Added PAT retrieval

  if (!organization) {
    throw new Error("Azure DevOps organization environment variable 'AZDO_ORG' is not set or is empty.");
  }
  if (!projectName) {
    throw new Error("Azure DevOps project name environment variable 'AZDO_PROJECT' is not set or is empty.");
  }
  if (!pat) { // Added PAT check
    throw new Error("Azure DevOps Personal Access Token environment variable 'AZDO_PAT' is not set or is empty.");
  }

  return { organization, projectName, pat }; // Added PAT to return object
}

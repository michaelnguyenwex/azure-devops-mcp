import { z } from "zod";

// Zod schema for configuration validation (can still be useful for other contexts if needed)
export const AzureDevOpsConfigSchema = z.object({
  organization: z.string().min(1, "Organization name cannot be empty."),
  projectName: z.string().min(1, "Project name cannot be empty."),
  pat: z.string().min(1, "Personal Access Token (PAT) cannot be empty."), // Added PAT
});

export type AzureDevOpsConfig = z.infer<typeof AzureDevOpsConfigSchema>;

// Zod schema for Splunk configuration validation
export const SplunkConfigSchema = z.object({
  host: z.string().min(1, "Splunk host cannot be empty."),
  port: z.number().positive("Splunk port must be a positive number."),
  scheme: z.enum(['http', 'https'], { errorMap: () => ({ message: "Splunk scheme must be 'http' or 'https'." }) }),
  token: z.string().min(1, "Splunk token cannot be empty."),
  verifySsl: z.boolean(),
});

export type SplunkConfig = z.infer<typeof SplunkConfigSchema>;

// Zod schema for OpenAI configuration validation
export const OpenAIConfigSchema = z.object({
  apiKey: z.string().min(1, "OpenAI API key cannot be empty."),
  baseUrl: z.string().min(1, "OpenAI API base URL cannot be empty."),
});

export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;

// Jira API base URL - getter function to ensure it's accessed at runtime
export function getJiraApiBaseUrl(): string {
  const baseUrl = process.env.JIRA_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("JIRA_API_BASE_URL environment variable not set or is empty.");
  }
  return baseUrl;
}

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

/**
 * Retrieves the Splunk configuration from environment variables.
 * Supports both SPLUNK_URL (full URL) and SPLUNK_HOST (hostname only).
 * @returns A promise that resolves to the SplunkConfig object.
 * @throws An error if the environment variables are not set, are empty, or fail validation.
 */
export async function getSplunkConfig(): Promise<SplunkConfig> {
  let host = process.env.SPLUNK_HOST;
  let port = process.env.SPLUNK_PORT;
  let scheme = process.env.SPLUNK_SCHEME;
  const token = process.env.SPLUNK_TOKEN;
  const verifySsl = process.env.VERIFY_SSL;

  // If SPLUNK_URL is provided, parse it to extract host, port, and scheme
  const splunkUrl = process.env.SPLUNK_URL;
  if (splunkUrl && !host) {
    try {
      const url = new URL(splunkUrl);
      host = url.hostname;
      port = port || url.port || (url.protocol === 'https:' ? '8089' : '8089');
      scheme = scheme || (url.protocol === 'https:' ? 'https' : 'http');
    } catch (error) {
      throw new Error(`Invalid SPLUNK_URL format: ${splunkUrl}`);
    }
  }

  if (!host) {
    throw new Error("Splunk host environment variable 'SPLUNK_HOST' or 'SPLUNK_URL' is not set or is empty.");
  }
  if (!port) {
    throw new Error("Splunk port environment variable 'SPLUNK_PORT' is not set or is empty.");
  }
  if (!scheme) {
    throw new Error("Splunk scheme environment variable 'SPLUNK_SCHEME' is not set or is empty.");
  }
  if (!token) {
    throw new Error("Splunk token environment variable 'SPLUNK_TOKEN' is not set or is empty.");
  }
  if (verifySsl === undefined) {
    throw new Error("Splunk verify SSL environment variable 'VERIFY_SSL' is not set.");
  }

  // Parse and validate the configuration
  const config: SplunkConfig = {
    host,
    port: parseInt(port, 10),
    scheme: scheme as 'http' | 'https',
    token,
    verifySsl: verifySsl === 'true'
  };

  // Validate using Zod schema
  return SplunkConfigSchema.parse(config);
}

/**
 * Retrieves the OpenAI configuration from environment variables.
 * @returns A promise that resolves to the OpenAIConfig object.
 * @throws An error if the environment variables are not set, are empty, or fail validation.
 */
export async function getOpenAIConfig(): Promise<OpenAIConfig> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_API_BASE_URL;

  if (!apiKey) {
    throw new Error("OpenAI API key environment variable 'OPENAI_API_KEY' is not set or is empty.");
  }
  if (!baseUrl) {
    throw new Error("OpenAI API base URL environment variable 'OPENAI_API_BASE_URL' is not set or is empty.");
  }

  const config: OpenAIConfig = {
    apiKey,
    baseUrl
  };

  // Validate using Zod schema
  return OpenAIConfigSchema.parse(config);
}

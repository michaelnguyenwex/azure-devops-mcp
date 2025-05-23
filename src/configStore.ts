/**
 * Stores and manages the global Azure DevOps configuration.
 */

interface AzureDevOpsConfig {
  organization?: string;
  projectName?: string;
}

let currentConfig: AzureDevOpsConfig = {};

/**
 * Sets the global Azure DevOps configuration.
 * @param config - The configuration object containing organization and project name.
 */
export async function setAzureDevOpsConfig(config: { organization: string; projectName: string }): Promise<void> {
  currentConfig = {
    organization: config.organization,
    projectName: config.projectName,
  };
}

/**
 * Retrieves the global Azure DevOps configuration.
 * @returns A promise that resolves to the configuration object.
 * @throws An error if the configuration is not set.
 */
export async function getAzureDevOpsConfig(): Promise<{ organization: string; projectName: string }> {
  if (!currentConfig.organization || !currentConfig.projectName) {
    throw new Error("Azure DevOps project configuration is not set. Please run the 'register-azure-project' tool to set it up.");
  }
  return {
    organization: currentConfig.organization,
    projectName: currentConfig.projectName,
  };
}

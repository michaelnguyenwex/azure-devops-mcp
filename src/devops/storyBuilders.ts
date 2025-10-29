import { DevOpsStoryFields } from './types.js';

/**
 * Builds a DevOps story for creating a feature flag
 * 
 * @param appName - The application name (e.g., "cdh-authservice")
 * @param ffName - The feature flag name (e.g., "CDH500-EnableNewUI")
 * @param month - The month abbreviation (e.g., "Feb")
 * @param target - The target deployment version (e.g., "2026.Feb (Feb)")
 * @param prodDeploy - The production deployment version (e.g., "2026.Feb")
 * @returns DevOpsStoryFields object with all required fields
 */
export function buildCreateFFStory(
  appName: string,
  ffName: string,
  month: string,
  target: string,
  prodDeploy: string
): DevOpsStoryFields {
  console.log(`\n📝 Building CreateFF story for ${ffName}`);
  
  const title = `[${month}] Add ${ffName} FF`;
  
  const description = `<div><div>Context: FeatureFlags<br> </div><div>Scope: ${appName} </div><div>Name: ${ffName} </div><div>Value: true</div> </div>`;
  
  const tags = `FeatureFlags; Scope:${appName}; yContext:FeatureFlags; zKey:${ffName}`;
  
  const story: DevOpsStoryFields = {
    "System.AreaPath": "Health",
    "System.TeamProject": "Health",
    "System.IterationPath": "Health",
    "System.WorkItemType": "DevOps Story",
    "System.State": "New",
    "System.Reason": "Moved to state New",
    "System.Title": title,
    "Custom.DesiredDate": target,
    "Custom.ImpactedEnvironments": "UAT; PROD; TRN;",
    "Custom.ProdDeployment": prodDeploy,
    "System.Description": description,
    "System.Tags": tags
  };
  
  console.log(`✅ CreateFF story built: ${title}`);
  
  return story;
}

/**
 * Builds a DevOps story for removing a feature flag
 * 
 * @param appName - The application name (e.g., "cdh-authservice")
 * @param ffName - The feature flag name (e.g., "CDH500-EnableNewUI")
 * @param month - The month abbreviation (e.g., "Feb")
 * @param target - The target deployment version (e.g., "2026.Feb (Feb)")
 * @param prodDeploy - The production deployment version (e.g., "2026.Feb")
 * @returns DevOpsStoryFields object with all required fields
 */
export function buildRemoveFFStory(
  appName: string,
  ffName: string,
  month: string,
  target: string,
  prodDeploy: string
): DevOpsStoryFields {
  console.log(`\n📝 Building RemoveFF story for ${ffName}`);
  
  const title = `[${month}] Remove ${ffName} FF`;
  
  const description = `<div><div>Context: Remove FeatureFlags<br> </div><div>Scope: ${appName} </div><div>Name: ${ffName} </div></div>`;
  
  const tags = `FeatureFlags; Scope:${appName}; yContext:FeatureFlags; zKey:${ffName}`;
  
  const story: DevOpsStoryFields = {
    "System.AreaPath": "Health",
    "System.TeamProject": "Health",
    "System.IterationPath": "Health",
    "System.WorkItemType": "DevOps Story",
    "System.State": "New",
    "System.Reason": "Moved to state New",
    "System.Title": title,
    "Custom.DesiredDate": target,
    "Custom.ImpactedEnvironments": "UAT; PROD; TRN;",
    "Custom.ProdDeployment": prodDeploy,
    "System.Description": description,
    "System.Tags": tags
  };
  
  console.log(`✅ RemoveFF story built: ${title}`);
  
  return story;
}

/**
 * Builds a DevOps story for running a pipeline
 * 
 * @param appName - The application name (e.g., "cdh-authservice")
 * @param pipelineName - The pipeline name (e.g., "cdh-authservice-api-az-cd")
 * @param pipelineUrl - The pipeline URL
 * @param month - The month abbreviation (e.g., "Feb")
 * @param target - The target deployment version (e.g., "2026.Feb (Feb)")
 * @param prodDeploy - The production deployment version (e.g., "2026.Feb")
 * @returns DevOpsStoryFields object with all required fields
 */
export function buildPipelineStory(
  appName: string,
  pipelineName: string,
  pipelineUrl: string,
  month: string,
  target: string,
  prodDeploy: string
): DevOpsStoryFields {
  console.log(`\n📝 Building Pipeline story for ${pipelineName}`);
  
  const title = `[${month}] ${appName} Run Pipeline`;
  
  const description = `<div><div>Context: Run pipeline:<br> </div><div>Pipeline Name: ${pipelineName}<br> </div><div>Pipeline URL: ${pipelineUrl}<br> </div></div>`;
  
  const tags = `Pipeline`;
  
  const story: DevOpsStoryFields = {
    "System.AreaPath": "Health",
    "System.TeamProject": "Health",
    "System.IterationPath": "Health",
    "System.WorkItemType": "DevOps Story",
    "System.State": "New",
    "System.Reason": "Moved to state New",
    "System.Title": title,
    "Custom.DesiredDate": target,
    "Custom.ImpactedEnvironments": "UAT; PROD; TRN;",
    "Custom.ProdDeployment": prodDeploy,
    "System.Description": description,
    "System.Tags": tags
  };
  
  console.log(`✅ Pipeline story built: ${title}`);
  
  return story;
}


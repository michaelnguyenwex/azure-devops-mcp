/**
 * Types and interfaces for Azure DevOps Story Creation
 */

/**
 * Mode of operation for DevOps story creation
 */
export type DevOpsMode = "CreateFF" | "RemoveFF" | "Pipeline";

/**
 * Result from parsing user's natural language request
 */
export interface ParsedUserRequest {
  mode: DevOpsMode;
  pr: string;
}

/**
 * Result from analyzing a GitHub PR for DevOps story creation
 */
export interface PRAnalysisResult {
  featureFlagName: string | null;
  month: string | null;
  target: string | null;
  prodDeploy: string | null;
  targetDate: string | null;
}

/**
 * Azure DevOps work item fields for story creation
 * Maps to Azure DevOps REST API field structure
 */
export interface DevOpsStoryFields {
  "System.AreaPath": string;
  "System.TeamProject": string;
  "System.IterationPath": string;
  "System.WorkItemType": string;
  "System.State": string;
  "System.Reason": string;
  "System.Title": string;
  "Custom.DesiredDate"?: string;
  "Custom.ImpactedEnvironments"?: string;
  "Custom.ProdDeployment"?: string;
  "System.Description"?: string;
  "System.Tags"?: string;
}

/**
 * Information about an Azure DevOps pipeline
 */
export interface PipelineInfo {
  id: number;
  name: string;
  url: string;
}


import { getAllPipelines } from './azureDevOpsClient.js';
import { PipelineInfo } from './types.js';

/**
 * Gets pipeline information by name
 * Searches through all pipelines to find one matching the given name
 * 
 * @param pipelineName - Name of the pipeline to find
 * @returns Promise resolving to pipeline info or null if not found
 */
export async function getPipelineInfo(pipelineName: string): Promise<PipelineInfo | null> {
  try {
    console.log(`\n🔍 Looking for pipeline: ${pipelineName}`);
    
    // Get all pipelines
    const pipelines = await getAllPipelines();
    
    // Search for matching pipeline
    const matchingPipeline = pipelines.find(
      (pipeline: any) => pipeline.name === pipelineName
    );
    
    if (!matchingPipeline) {
      console.warn(`⚠️  Pipeline not found: ${pipelineName}`);
      console.warn(`   Available pipelines (first 10): ${pipelines.slice(0, 10).map((p: any) => p.name).join(', ')}`);
      return null;
    }
    
    // Extract pipeline ID
    let pipelineId = matchingPipeline.id;
    
    // Alternative: extract from _links.web.href if id is not directly available
    if (!pipelineId && matchingPipeline._links?.web?.href) {
      const match = matchingPipeline._links.web.href.match(/definitionId=(\d+)/);
      if (match) {
        pipelineId = parseInt(match[1], 10);
      }
    }
    
    if (!pipelineId) {
      console.error(`❌ Could not extract pipeline ID for: ${pipelineName}`);
      return null;
    }
    
    // Build pipeline URL
    // Note: We need the organization name from config
    const { getAzureDevOpsConfig } = await import('../configStore.js');
    const config = await getAzureDevOpsConfig();
    const pipelineUrl = `https://dev.azure.com/${config.organization}/${config.projectName}/_build?definitionId=${pipelineId}`;
    
    const pipelineInfo: PipelineInfo = {
      id: pipelineId,
      name: matchingPipeline.name,
      url: pipelineUrl
    };
    
    console.log(`✅ Found pipeline:`, pipelineInfo);
    
    return pipelineInfo;
  } catch (error) {
    console.error(`❌ Failed to get pipeline info for ${pipelineName}:`, error);
    throw new Error(`Failed to get pipeline info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


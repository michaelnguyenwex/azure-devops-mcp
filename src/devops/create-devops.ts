/**
 * Main orchestrator for creating Azure DevOps stories from GitHub PR URLs
 * 
 * Required environment variables:
 * - AZDO_PAT: Azure DevOps Personal Access Token
 * - AZDO_ORG: Azure DevOps organization name (e.g., WexHealthTech)
 * - AZDO_PROJECT: Azure DevOps project name (e.g., Health)
 * - OPENAI_API_KEY: OpenAI API key
 * - OPENAI_API_BASE_URL: OpenAI API base URL
 * - GITHUB_TOKEN or GITHUB_PAT: GitHub personal access token
 */

import { parseUserRequest } from './requestParser.js';
import { GitHubService } from '../triage/githubService.js';
import { buildCreateFFStory, buildRemoveFFStory, buildPipelineStory } from './storyBuilders.js';
import { createWorkItem } from './azureDevOpsClient.js';
import { getPipelineInfo } from './pipelineService.js';
import { DevOpsMode } from './types.js';
import { getOpenAIConfig } from '../configStore.js';
import axios from 'axios';

/**
 * Main function to create an Azure DevOps story from a user request
 * 
 * @param userRequest - Natural language request (e.g., "create ff https://github.com/...")
 * @returns Promise resolving to created work item details
 * @throws Error if creation fails at any step
 */
export async function createDevOpsStory(userRequest: string): Promise<any> {
  try {
    console.log('\n🚀 Starting DevOps story creation...');
    console.log(`📝 User request: ${userRequest}`);
    
    // Step 1: Parse user request
    console.log('\n📋 Step 1: Parsing user request...');
    const parsed = await parseUserRequest(userRequest);
    const { mode, pr } = parsed;
    console.log(`✅ Mode: ${mode}, PR: ${pr}`);
    
    // Step 2: Get PR details and analyze
    console.log('\n📋 Step 2: Analyzing PR...');
    const githubService = new GitHubService();
    const prAnalysis = await githubService.analyzePRForDevOps(pr);
    
    // Validate required fields based on mode
    if ((mode === 'CreateFF' || mode === 'RemoveFF') && !prAnalysis.featureFlagName) {
      throw new Error('Feature flag name not found in PR. Please ensure the PR contains feature flag information.');
    }
    
    if (!prAnalysis.month || !prAnalysis.target || !prAnalysis.prodDeploy) {
      throw new Error('Deployment information not found in PR. Please ensure the PR contains deployment date information.');
    }
    
    console.log(`✅ PR Analysis complete:`, {
      featureFlagName: prAnalysis.featureFlagName,
      month: prAnalysis.month,
      target: prAnalysis.target,
      prodDeploy: prAnalysis.prodDeploy,
      targetDate: prAnalysis.targetDate
    });
    
    // Step 3: Get app name
    console.log('\n📋 Step 3: Getting app name...');
    const appInfo = await githubService.getAppNameFromPR(pr);
    if (!appInfo || !appInfo.appName) {
      throw new Error('Could not determine app name from PR. Please check the PR URL and repository configuration.');
    }
    
    const appName = appInfo.appName;
    const pipelineName = appInfo.pipeLineName;
    console.log(`✅ App name: ${appName}`);
    console.log(`✅ Pipeline name: ${pipelineName}`);
    
    // Step 4: Handle mode-specific logic
    console.log(`\n📋 Step 4: Building ${mode} story...`);
    
    let workItem: any;
    
    if (mode === 'CreateFF') {
      // Create FF mode
      if (!prAnalysis.featureFlagName) {
        throw new Error('Feature flag name is required for CreateFF mode');
      }
      
      const storyFields = buildCreateFFStory(
        appName,
        prAnalysis.featureFlagName,
        prAnalysis.month,
        prAnalysis.targetDate || prAnalysis.target,
        prAnalysis.prodDeploy
      );
      
      workItem = await createWorkItem(storyFields);
      
    } else if (mode === 'RemoveFF') {
      // Remove FF mode
      if (!prAnalysis.featureFlagName) {
        throw new Error('Feature flag name is required for RemoveFF mode');
      }
      
      const storyFields = buildRemoveFFStory(
        appName,
        prAnalysis.featureFlagName,
        prAnalysis.month,
        prAnalysis.targetDate || prAnalysis.target,
        prAnalysis.prodDeploy
      );
      
      workItem = await createWorkItem(storyFields);
      
    } else if (mode === 'Pipeline') {
      // Pipeline mode
      console.log(`\n🔍 Looking for pipeline: ${pipelineName}`);
      
      const pipelineInfo = await getPipelineInfo(pipelineName);
      
      if (!pipelineInfo) {
        // Try alternative pipeline name extraction using OpenAI
        console.log('⚠️  Pipeline not found with standard name, trying OpenAI extraction...');
        const extractedPipelineName = await extractPipelineName(
          appName, 
          appInfo.prDetails?.title || '', 
          appInfo.prDetails?.description || ''
        );
        
        const retryPipelineInfo = await getPipelineInfo(extractedPipelineName);
        
        if (!retryPipelineInfo) {
          throw new Error(`Pipeline not found: ${pipelineName} or ${extractedPipelineName}. Please check the pipeline name.`);
        }
        
        const storyFields = buildPipelineStory(
          appName,
          retryPipelineInfo.name,
          retryPipelineInfo.url,
          prAnalysis.month,
          prAnalysis.targetDate || prAnalysis.target,
          prAnalysis.prodDeploy
        );
        
        workItem = await createWorkItem(storyFields);
      } else {
        const storyFields = buildPipelineStory(
          appName,
          pipelineInfo.name,
          pipelineInfo.url,
          prAnalysis.month,
          prAnalysis.targetDate || prAnalysis.target,
          prAnalysis.prodDeploy
        );
        
        workItem = await createWorkItem(storyFields);
      }
    } else {
      throw new Error(`Unknown mode: ${mode}`);
    }
    
    // Success!
    console.log(`\n✅ DevOps story created successfully!`);
    console.log(`📌 Work Item ID: ${workItem.id}`);
    
    return workItem;
    
  } catch (error) {
    console.error('\n❌ Failed to create DevOps story:', error);
    throw error;
  }
}

/**
 * Helper function to extract pipeline name using OpenAI
 * @param appName - Application name
 * @param prTitle - PR title
 * @param prBody - PR body
 * @returns Promise resolving to extracted pipeline name
 */
async function extractPipelineName(appName: string, prTitle: string, prBody: string): Promise<string> {
  try {
    console.log(`\n🤖 Using OpenAI to extract pipeline name...`);
    
    const openAIConfig = await getOpenAIConfig();
    
    const prompt = `Extract or infer the pipeline name from this PR context.

App Name: ${appName}
PR Title: ${prTitle}
PR Body: ${prBody}

Common pipeline naming patterns:
- app-name + "-api-az-cd"
- app-name + "-az-cd"
- Remove "health-" prefix from repo name
- Example: "health-cdh-authservice" → "cdh-authservice-api-az-cd"

Return only the pipeline name, no other text.`;

    const response = await axios.post(
      `${openAIConfig.baseUrl}/chat/completions`,
      {
        model: 'azure-gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a pipeline name extractor. Return only the pipeline name.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${openAIConfig.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0]?.message?.content?.trim();
    
    if (!content) {
      // Fallback: use app name with standard suffix
      const fallback = `${appName}-api-az-cd`;
      console.log(`⚠️  No OpenAI response, using fallback: ${fallback}`);
      return fallback;
    }
    
    console.log(`✅ Extracted pipeline name: ${content}`);
    return content;
    
  } catch (error) {
    console.error('❌ Failed to extract pipeline name with OpenAI:', error);
    // Fallback: use app name with standard suffix
    const fallback = `${appName}-api-az-cd`;
    console.log(`⚠️  Using fallback pipeline name: ${fallback}`);
    return fallback;
  }
}


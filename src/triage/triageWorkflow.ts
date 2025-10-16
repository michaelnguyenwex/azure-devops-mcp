import { SplunkLogEvent, TriageData, Commit } from './types.js';
import { aggregateErrorsBySignature } from './errorParser.js';
import { DeploymentService } from './deploymentService.js';
import { GitHubService } from './githubService.js';
import { findSuspectedCommits } from './commitAnalyzer.js';
import { JiraService } from './jiraService.js';
import { formatJiraTicket } from './jiraFormatter.js';
import { StateManager } from './stateManager.js';
import { SplunkUrlBuilder } from '../integrations/splunk/urlBuilder.js';

/**
 * Configuration options for the triage workflow
 */
export interface TriageConfig {
  /** GitHub repository name (e.g., 'company/service-repo') */
  repositoryName?: string;
  
  /** Jira project key for creating tickets */
  jiraProjectKey?: string;
  
  /** Number of days to look back for commits */
  commitLookbackDays?: number;
  
  /** Base URL for Splunk to create links */
  splunkBaseUrl?: string;
  
  /** Whether to actually create Jira tickets (false for dry-run) */
  createTickets?: boolean;
}

/**
 * Main triage workflow function that orchestrates the entire error triage process.
 * 
 * This function:
 * 1. Groups incoming log events by error signature
 * 2. Checks if each error has already been processed
 * 3. For new errors, gathers deployment and commit information
 * 4. Creates detailed Jira tickets with suspected root causes
 * 5. Marks errors as processed to prevent duplicates
 * 
 * @param logs - Array of Splunk log events to analyze
 * @param config - Optional configuration for the triage process
 */
export async function runTriage(logs: SplunkLogEvent[], config: TriageConfig = {}): Promise<void> {
  console.log(`Starting triage analysis for ${logs.length} log events`);
  
  try {
    // Initialize all services
    const deploymentService = new DeploymentService();
    const githubService = new GitHubService();
    const jiraService = new JiraService();
    const stateManager = new StateManager();
    
    // Set default configuration values
    const triageConfig = {
      repositoryName: 'company/service-repo', // Default - should be configurable
      jiraProjectKey: 'PROD',
      commitLookbackDays: 7,
      splunkBaseUrl: 'https://splunk.company.com',
      createTickets: true,
      ...config
    };
    
    console.log('Triage configuration:', triageConfig);
    
    // Step 1: Group errors by signature
    console.log('Aggregating errors by signature...');
    const errorGroups = aggregateErrorsBySignature(logs);
    console.log(`Found ${errorGroups.size} unique error signatures`);
    
    // Step 2: Process each unique error signature
    let processedCount = 0;
    let skippedCount = 0;
    
    for (const [signature, errorLogs] of errorGroups) {
      try {
        console.log(`\nProcessing error signature: ${signature.substring(0, 100)}...`);
        console.log(`Error occurred ${errorLogs.length} times`);
        
        // Step 2a: Check if this error has already been processed
        const alreadyProcessed = await stateManager.isErrorProcessed(signature);
        if (alreadyProcessed) {
          console.log('Error signature already processed, skipping...');
          skippedCount++;
          continue;
        }
        
        // Step 2b: Extract key information from the error logs
        const firstError = errorLogs[0];
        const serviceName = firstError.serviceName || firstError.source || 'unknown-service';
        const environment = firstError.environment || 'unknown-environment';
        const firstSeen = errorLogs
          .map(log => new Date(log._time))
          .sort((a, b) => a.getTime() - b.getTime())[0]
          .toISOString();
        
        console.log(`Service: ${serviceName}, Environment: ${environment}, First seen: ${firstSeen}`);
        
        // Step 2c: Get deployment information
        console.log('Fetching deployment information...');
        let deploymentInfo;
        try {
          deploymentInfo = await deploymentService.getDeployedCommit(serviceName, environment, firstSeen);
          console.log(`Found deployment: ${deploymentInfo.commitHash}`);
        } catch (error) {
          console.warn('Failed to get deployment information:', error);
          // Continue without deployment info - we can still analyze commits
        }
        
        // Step 2d: Get recent commits
        console.log('Fetching recent commits...');
        const lookbackDate = new Date(Date.now() - (triageConfig.commitLookbackDays! * 24 * 60 * 60 * 1000)).toISOString();
        let recentCommits: Commit[] = [];
        
        try {
          recentCommits = await githubService.getCommitsSince(triageConfig.repositoryName!, lookbackDate);
          console.log(`Found ${recentCommits.length} recent commits`);
        } catch (error) {
          console.warn('Failed to get recent commits:', error);
          // Continue without commit analysis
        }
        
        // Step 2e: Analyze commits for suspected causes
        console.log('Analyzing commits for potential causes...');
        const suspectedCommits = findSuspectedCommits(firstError.message, recentCommits);
        console.log(`Identified ${suspectedCommits.length} suspected commits`);
        
        // Step 2f: Build triage data
        const triageData: TriageData = {
          errorSignature: signature,
          errorCount: errorLogs.length,
          splunkLink: SplunkUrlBuilder.buildSearchLink(signature, firstSeen, triageConfig.splunkBaseUrl),
          errorMessage: firstError.message,
          firstSeen,
          suspectedCommits,
          serviceName,
          environment,
          deploymentInfo
        };
        
        // Step 2g: Create Jira ticket
        if (triageConfig.createTickets) {
          console.log('Creating Jira ticket...');
          
          try {
            const { summary, description } = formatJiraTicket(triageData);
            const ticketResult = await jiraService.createTriageTicket(
              summary, 
              description, 
              triageConfig.jiraProjectKey
            );
            
            console.log(`Created Jira ticket: ${ticketResult.issueKey}`);
            
            // Step 2h: Mark as processed
            await stateManager.markErrorAsProcessed(signature, ticketResult.issueKey, {
              serviceName,
              environment,
              errorCount: errorLogs.length,
              firstSeen
            });
            
            console.log('Marked error as processed');
            processedCount++;
            
          } catch (error) {
            console.error('Failed to create Jira ticket:', error);
            // Don't mark as processed if ticket creation failed
            continue;
          }
        } else {
          console.log('Dry-run mode: would create ticket for this error');
          processedCount++;
        }
        
      } catch (error) {
        console.error(`Failed to process error signature: ${signature.substring(0, 50)}...`, error);
        // Continue with next error signature
      }
    }
    
    // Summary
    console.log('\n=== Triage Analysis Complete ===');
    console.log(`Total unique error signatures: ${errorGroups.size}`);
    console.log(`Newly processed: ${processedCount}`);
    console.log(`Already processed (skipped): ${skippedCount}`);
    console.log(`Total log events analyzed: ${logs.length}`);
    
  } catch (error) {
    console.error('Triage workflow failed:', error);
    throw new Error(`Triage analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Note: Splunk URL building logic moved to src/integrations/splunk/urlBuilder.ts
// This centralizes Splunk URL construction and leverages existing configuration

/**
 * Validates the input logs and configuration before running triage.
 * 
 * @param logs - Log events to validate
 * @param config - Configuration to validate
 * @throws Error if validation fails
 */
export function validateTriageInput(logs: SplunkLogEvent[], config: TriageConfig): void {
  if (!logs || !Array.isArray(logs)) {
    throw new Error('Logs must be a non-empty array');
  }
  
  if (logs.length === 0) {
    throw new Error('No log events provided for analysis');
  }
  
  // Validate that logs have required fields
  const invalidLogs = logs.filter(log => !log._time || !log.message);
  if (invalidLogs.length > 0) {
    throw new Error(`Found ${invalidLogs.length} log events missing required fields (_time, message)`);
  }
  
  // Validate configuration if provided
  if (config.repositoryName && !/^[\w.-]+\/[\w.-]+$/.test(config.repositoryName)) {
    throw new Error('Repository name must be in format "owner/repo"');
  }
  
  if (config.commitLookbackDays && (config.commitLookbackDays < 1 || config.commitLookbackDays > 30)) {
    throw new Error('Commit lookback days must be between 1 and 30');
  }
}

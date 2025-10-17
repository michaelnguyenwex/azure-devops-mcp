import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseRawSplunkEvent, parseRawSplunkEventWithOpenAI } from './splunkParser.js';
import { findSuspectedCommits } from './commitAnalyzer.js';
import { createCommitAnalyzer } from './commitAnalyzerOpenAI.js';
import { GitHubService } from './githubService.js';
import { RawSplunkEvent, TriageInput, Commit } from './types.js';

// Types for internal use
interface CommitAnalysisResult {
  commit: Commit;
  relevanceScore?: number;
  reasoning?: string;
  rollbackRisk?: string;
  keyFactors?: string[];
}

interface AnalysisResults {
  triageInput: TriageInput;
  suspectedCommits: Commit[];
  commitAnalysisResults: CommitAnalysisResult[];
  useAI: boolean;
}

/**
 * Parses Splunk error data using OpenAI
 */
async function parseErrorData(rawSplunkData: string): Promise<TriageInput> {
  console.log('📋 Step 1: Parsing raw Splunk data and extracting error information with OpenAI...');
  const triageInput: TriageInput = await parseRawSplunkEventWithOpenAI(rawSplunkData);
  
  console.log('✅ Parsed error details:', {
    serviceName: triageInput.serviceName,
    environment: triageInput.environment,
    exceptionType: triageInput.exceptionType,
    errorMessage: triageInput.errorMessage.substring(0, 100) + (triageInput.errorMessage.length > 100 ? '...' : ''),
    stackFrames: triageInput.stackTrace.length,
    searchKeywords: {
      files: triageInput.searchKeywords.files.length,
      methods: triageInput.searchKeywords.methods.length,
      context: triageInput.searchKeywords.context.length
    }
  });
  
  return triageInput;
}

/**
 * Analyzes GitHub commits for potential root causes
 */
async function analyzeCommits(
  triageInput: TriageInput,
  repositoryName: string,
  commitLookbackDays: number,
  useAI: boolean
): Promise<{ suspectedCommits: Commit[]; commitAnalysisResults: CommitAnalysisResult[] }> {
  console.log('🔍 Step 3: Analyzing GitHub commits with AI-powered semantic analysis...');
  const githubService = new GitHubService();
  
  let suspectedCommits: Commit[] = [];
  let commitAnalysisResults: CommitAnalysisResult[] = [];
  
  if (!repositoryName) {
    console.log('⚠️  No repository specified - skipping GitHub analysis');
    return { suspectedCommits, commitAnalysisResults };
  }

  try {
    const lookbackDate = new Date(Date.now() - (commitLookbackDays * 24 * 60 * 60 * 1000)).toISOString();
    const recentCommits = await githubService.getCommitsSince(repositoryName, lookbackDate);
    
    console.log(`📊 Found ${recentCommits.length} recent commits to analyze`);
    
    if (recentCommits.length > 0) {
      const analyzer = await createCommitAnalyzer(useAI);
      
      console.log(`🤖 Using ${useAI ? 'OpenAI-powered semantic' : 'rule-based pattern'} analysis...`);
      
      commitAnalysisResults = await analyzer.analyzeSuspectedCommits(triageInput, recentCommits);
      suspectedCommits = commitAnalysisResults.map(result => result.commit);
      
      console.log(`🎯 Identified ${suspectedCommits.length} suspected commits`);
      
      if (useAI && commitAnalysisResults.length > 0) {
        console.log('🤖 AI Analysis Summary:');
        commitAnalysisResults.slice(0, 3).forEach((result, index) => {
          console.log(`  ${index + 1}. Score: ${result.relevanceScore}/100 - ${result.reasoning?.substring(0, 100)}...`);
        });
      }
    }
    
  } catch (githubError) {
    console.warn('⚠️  GitHub analysis failed:', githubError instanceof Error ? githubError.message : 'Unknown error');
    console.log('🔄 Falling back to basic commit listing...');
  }
  
  return { suspectedCommits, commitAnalysisResults };
}

/**
 * Displays analysis results to console
 */
function displayAnalysisResults(results: AnalysisResults): void {
  const { triageInput, suspectedCommits, commitAnalysisResults, useAI } = results;
  
  console.log('\n📋 Analysis Results:');
  console.log('='.repeat(50));
  console.log(`Service: ${triageInput.serviceName}`);
  console.log(`Environment: ${triageInput.environment}`);
  console.log(`Exception: ${triageInput.exceptionType}`);
  console.log(`Error: ${triageInput.errorMessage}`);
  console.log(`Stack Frames: ${triageInput.stackTrace.length}`);
  
  if (triageInput.stackTrace.length > 0) {
    console.log('\n🔍 Key Stack Frames:');
    triageInput.stackTrace.slice(0, 5).forEach((frame, index) => {
      console.log(`  ${index + 1}. ${frame.method} in ${frame.file}${frame.line ? `:${frame.line}` : ''}`);
    });
  }
  
  if (suspectedCommits.length > 0) {
    console.log('\n🎯 Top Candidates:');
    
    if (useAI && commitAnalysisResults.length > 0) {
      displayAIResults(commitAnalysisResults, triageInput);
    } else {
      displayRuleBasedResults(suspectedCommits, triageInput);
    }
    
    displayRiskAssessment(suspectedCommits, commitAnalysisResults, useAI, triageInput);
  }
}

/**
 * Displays AI analysis results
 */
function displayAIResults(commitAnalysisResults: CommitAnalysisResult[], triageInput: TriageInput): void {
  commitAnalysisResults.slice(0, 5).forEach((result, index) => {
    const commit = result.commit;
    console.log(`\n  ${index + 1}. ${commit.hash.substring(0, 8)} - Score: ${result.relevanceScore || 'N/A'}/100`);
    console.log(`     Message: ${commit.message.split('\n')[0].substring(0, 80)}${commit.message.split('\n')[0].length > 80 ? '...' : ''}`);
    console.log(`     Author: ${commit.author}`);
    console.log(`     Date: ${new Date(commit.date).toLocaleString()}`);
    
    if (result.rollbackRisk) {
      console.log(`     Risk Level: ${result.rollbackRisk}`);
    }
    
    if (result.reasoning) {
      console.log(`     AI Analysis: ${result.reasoning.substring(0, 150)}${result.reasoning.length > 150 ? '...' : ''}`);
    }
    
    displayCommitFiles(commit, triageInput);
  });
}

/**
 * Displays rule-based analysis results
 */
function displayRuleBasedResults(suspectedCommits: Commit[], triageInput: TriageInput): void {
  suspectedCommits.slice(0, 5).forEach((commit, index) => {
    console.log(`\n  ${index + 1}. ${commit.hash.substring(0, 8)} - ${commit.message.split('\n')[0].substring(0, 80)}${commit.message.split('\n')[0].length > 80 ? '...' : ''}`);
    console.log(`     Author: ${commit.author}`);
    console.log(`     Date: ${new Date(commit.date).toLocaleString()}`);
    
    displayCommitFiles(commit, triageInput);
  });
}

/**
 * Displays commit file information
 */
function displayCommitFiles(commit: Commit, triageInput: TriageInput): void {
  if (commit.changedFiles && commit.changedFiles.length > 0) {
    console.log(`     Files Changed (${commit.changedFiles.length}): ${commit.changedFiles.slice(0, 3).join(', ')}${commit.changedFiles.length > 3 ? '...' : ''}`);
  }
  
  if (commit.pullRequestUrl) {
    const prMatch = commit.pullRequestUrl.match(/\/pull\/(\d+)/);
    const prNumber = prMatch ? prMatch[1] : commit.pullRequestUrl.split('/').pop();
    console.log(`     PR: #${prNumber} (${commit.pullRequestUrl})`);
  }
  
  const matchingFiles = commit.changedFiles?.filter((file: string) => 
    triageInput.searchKeywords.files.some(errorFile => 
      file.toLowerCase().includes(errorFile.toLowerCase().replace('.cs', ''))
    )
  ) || [];
  
  if (matchingFiles.length > 0) {
    console.log(`     🔍 Files matching error: ${matchingFiles.join(', ')}`);
  }
}

/**
 * Displays risk assessment summary
 */
function displayRiskAssessment(
  suspectedCommits: Commit[], 
  commitAnalysisResults: CommitAnalysisResult[], 
  useAI: boolean, 
  triageInput: TriageInput
): void {
  console.log(`\n📊 Risk Assessment:`);
  console.log(`   • Analysis Method: ${useAI ? 'OpenAI-powered semantic analysis' : 'Rule-based pattern matching'}`);
  console.log(`   • Total suspected commits: ${suspectedCommits.length}`);
  console.log(`   • Most recent suspect: ${new Date(suspectedCommits[0].date).toLocaleString()}`);
  console.log(`   • Files at risk: ${triageInput.searchKeywords.files.join(', ')}`);
  
  if (useAI && commitAnalysisResults.length > 0) {
    const highRiskCommits = commitAnalysisResults.filter(r => r.rollbackRisk === 'HIGH').length;
    const mediumRiskCommits = commitAnalysisResults.filter(r => r.rollbackRisk === 'MEDIUM').length;
    if (highRiskCommits > 0 || mediumRiskCommits > 0) {
      console.log(`   • Risk Distribution: ${highRiskCommits} HIGH, ${mediumRiskCommits} MEDIUM risk commits`);
    }
  }
}

/**
 * Builds detailed commit analysis text for the response
 */
function buildCommitAnalysisText(results: AnalysisResults): string {
  const { triageInput, suspectedCommits, commitAnalysisResults, useAI } = results;
  
  if (suspectedCommits.length === 0) {
    return '';
  }

  let commitAnalysisText = `\n\n**🎯 Top Candidates Analysis (${useAI ? 'AI-Powered' : 'Rule-Based'}):**\n\n`;
  
  if (useAI && commitAnalysisResults.length > 0) {
    commitAnalysisText += buildAIAnalysisText(commitAnalysisResults, triageInput);
  } else {
    commitAnalysisText += buildRuleBasedAnalysisText(suspectedCommits, triageInput);
  }
  
  commitAnalysisText += buildRiskAssessmentText(suspectedCommits, commitAnalysisResults, useAI, triageInput);
  
  return commitAnalysisText;
}

/**
 * Builds AI analysis text section
 */
function buildAIAnalysisText(commitAnalysisResults: CommitAnalysisResult[], triageInput: TriageInput): string {
  let text = '';
  
  commitAnalysisResults.slice(0, 5).forEach((result, index) => {
    const commit = result.commit;
    const commitTitle = commit.message.split('\n')[0];
    const matchingFiles = getMatchingFiles(commit, triageInput);
    
    text += `**${index + 1}. Commit ${commit.hash.substring(0, 8)} - Score: ${result.relevanceScore}/100**\n`;
    text += `• **Message**: ${commitTitle}\n`;
    text += `• **Author**: ${commit.author}\n`;
    text += `• **Date**: ${new Date(commit.date).toLocaleString()}\n`;
    text += `• **Files Changed**: ${commit.changedFiles?.length || 0} files\n`;
    
    if (result.rollbackRisk) {
      text += `• **Risk Level**: ${result.rollbackRisk}\n`;
    }
    
    if (result.reasoning) {
      text += `• **AI Analysis**: ${result.reasoning}\n`;
    }
    
    text += addCommitDetailsToText(commit, matchingFiles);
    text += '\n';
  });
  
  return text;
}

/**
 * Builds rule-based analysis text section
 */
function buildRuleBasedAnalysisText(suspectedCommits: Commit[], triageInput: TriageInput): string {
  let text = '';
  
  suspectedCommits.slice(0, 5).forEach((commit, index) => {
    const commitTitle = commit.message.split('\n')[0];
    const matchingFiles = getMatchingFiles(commit, triageInput);
    
    text += `**${index + 1}. Commit ${commit.hash.substring(0, 8)}**\n`;
    text += `• **Message**: ${commitTitle}\n`;
    text += `• **Author**: ${commit.author}\n`;
    text += `• **Date**: ${new Date(commit.date).toLocaleString()}\n`;
    text += `• **Files Changed**: ${commit.changedFiles?.length || 0} files\n`;
    
    text += addCommitDetailsToText(commit, matchingFiles);
    text += '\n';
  });
  
  return text;
}

/**
 * Adds commit details (files, PR, matching files) to text
 */
function addCommitDetailsToText(commit: Commit, matchingFiles: string[]): string {
  let text = '';
  
  if (commit.changedFiles && commit.changedFiles.length > 0) {
    text += `• **Key Files**: ${commit.changedFiles.slice(0, 3).join(', ')}${commit.changedFiles.length > 3 ? '...' : ''}\n`;
  }
  
  if (matchingFiles.length > 0) {
    text += `• **⚠️ Files Matching Error**: ${matchingFiles.join(', ')}\n`;
  }
  
  if (commit.pullRequestUrl) {
    const prMatch = commit.pullRequestUrl.match(/\/pull\/(\d+)/);
    const prNumber = prMatch ? prMatch[1] : commit.pullRequestUrl.split('/').pop();
    text += `• **PR**: #${prNumber} - ${commit.pullRequestUrl}\n`;
  }
  
  return text;
}

/**
 * Builds risk assessment text section
 */
function buildRiskAssessmentText(
  suspectedCommits: Commit[], 
  commitAnalysisResults: CommitAnalysisResult[], 
  useAI: boolean, 
  triageInput: TriageInput
): string {
  let text = `**📊 Risk Assessment:**\n`;
  text += `• **Analysis Method**: ${useAI ? 'OpenAI-powered semantic analysis' : 'Rule-based pattern matching'}\n`;
  text += `• **Total Suspected Commits**: ${suspectedCommits.length}\n`;
  text += `• **Most Recent Suspect**: ${new Date(suspectedCommits[0].date).toLocaleString()}\n`;
  text += `• **Critical Files at Risk**: ${triageInput.searchKeywords.files.join(', ')}\n`;
  
  if (useAI && commitAnalysisResults.length > 0) {
    const highRiskCommits = commitAnalysisResults.filter(r => r.rollbackRisk === 'HIGH').length;
    const mediumRiskCommits = commitAnalysisResults.filter(r => r.rollbackRisk === 'MEDIUM').length;
    if (highRiskCommits > 0 || mediumRiskCommits > 0) {
      text += `• **Risk Distribution**: ${highRiskCommits} HIGH, ${mediumRiskCommits} MEDIUM risk commits\n`;
    }
    text += `• **Recommendation**: Focus on HIGH risk commits first - these are prime rollback candidates\n`;
  } else {
    text += `• **Recommendation**: Review commits in order of suspicion for potential rollback\n`;
  }
  
  return text;
}

/**
 * Gets files that match between commit changes and error files
 */
function getMatchingFiles(commit: Commit, triageInput: TriageInput): string[] {
  return commit.changedFiles?.filter((file: string) => 
    triageInput.searchKeywords.files.some(errorFile => 
      file.toLowerCase().includes(errorFile.toLowerCase().replace('.cs', ''))
    )
  ) || [];
}

/**
 * Formats the final triage response
 */
function formatTriageResponse(results: AnalysisResults): any {
  const { triageInput, suspectedCommits, useAI } = results;
  const commitAnalysisText = buildCommitAnalysisText(results);
  
  return {
    content: [{
      type: "text",
      text: `✅ **AI-Powered Triage Analysis Completed**\n\n**🔍 Service Details:**\n• **Application**: ${triageInput.serviceName}\n• **Environment**: ${triageInput.environment}\n• **Exception Type**: ${triageInput.exceptionType}\n• **Error Message**: ${triageInput.errorMessage}\n\n**📋 Technical Analysis:**\n• **Analysis Method**: ${useAI ? 'OpenAI-powered semantic analysis' : 'Rule-based pattern matching'}\n• **Stack Frames Analyzed**: ${triageInput.stackTrace.length}\n• **Key Files Involved**: ${triageInput.searchKeywords.files.join(', ')}\n• **Critical Methods**: ${triageInput.searchKeywords.methods.join(', ')}\n• **Context Keywords**: ${triageInput.searchKeywords.context.join(', ')}\n• **GitHub Commits Analyzed**: ${suspectedCommits.length > 0 ? suspectedCommits.length : 'None (no repository specified)'}${commitAnalysisText}\n\n**🚀 Next Steps for Development Team:**\n1. **${useAI ? 'Focus on HIGH Risk Commits' : 'Review Suspected Commits'}**: ${useAI ? 'AI has identified the most likely rollback candidates' : 'Start with the highest-ranked commits above'}\n2. **Check File Overlap**: Focus on commits that modified files in the error stack trace\n3. **Assess Risk vs. Impact**: ${useAI ? 'Use AI risk levels to prioritize rollback decisions' : 'Consider rollback for recent commits with high file overlap'}\n4. **Test Hypothesis**: Use commit details and PR links to understand the changes\n5. **Decision Point**: ${useAI ? 'AI reasoning provides confidence levels for rollback decisions' : 'Determine if rollback is safer than forward-fix based on change complexity'}\n\n${suspectedCommits.length > 0 ? (useAI ? 'This AI-powered analysis provides confident recommendations with detailed reasoning to support rapid rollback decisions during production incidents.' : 'This analysis provides specific commits ranked by relevance to help make informed decisions.') : 'Enable GitHub analysis by providing a repository name to get commit recommendations.'}`
    }]
  };
}

/**
 * Registers the triage Splunk error tool with the MCP server.
 * 
 * This tool uses OpenAI to parse raw Splunk JSON data, extracts error information and stack traces,
 * then analyzes GitHub commits to identify potential root causes.
 * This is an analysis-only tool that does not create tickets.
 * 
 * @param server - The MCP server instance to register the tool with
 */
export function triageSplunkErrorTool(server: McpServer) {
  server.tool(
    "triage_splunk_error",
    "Use OpenAI to parse raw Splunk JSON data and perform AI-powered semantic analysis of GitHub commits to identify suspected root causes for production errors",
    {
      rawSplunkData: z.string().describe("Raw Splunk JSON string containing error details and stack trace"),
      repositoryName: z.string().describe("GitHub repository name in format 'owner/repo' (e.g., 'company/service-repo')"),
      commitLookbackDays: z.number().min(1).max(30).optional().describe("Number of days to look back for commits (1-30, default: 7)"),
      useOpenAI: z.boolean().optional().describe("Use OpenAI-powered semantic commit analysis (default: true). Set to false for rule-based analysis.")
    },
    async ({ rawSplunkData, repositoryName, commitLookbackDays, useOpenAI }) => {
      try {
        console.log(`\n🔍 Starting automated error triage with OpenAI-powered analysis (Splunk parsing + Commit analysis)`);
        
        // Step 1: Parse error data
        const triageInput = await parseErrorData(rawSplunkData);
        
        // Step 2: Analyze GitHub commits
        const commitLookbackDaysVal = commitLookbackDays || 7;
        const useAI = useOpenAI !== false; // Default to true if not specified
        const { suspectedCommits, commitAnalysisResults } = await analyzeCommits(
          triageInput, 
          repositoryName, 
          commitLookbackDaysVal, 
          useAI
        );
        
        // Step 3: Display results
        const results: AnalysisResults = {
          triageInput,
          suspectedCommits,
          commitAnalysisResults,
          useAI
        };
        
        displayAnalysisResults(results);
        
        // Step 4: Return formatted response
        return formatTriageResponse(results);
        
      } catch (error) {
        console.error('❌ Triage analysis failed:', error);
        
        return {
          content: [{
            type: "text", 
            text: `❌ Triage analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nThis could be due to:\n• Invalid raw Splunk JSON format\n• Malformed _raw field in Splunk data\n• Missing required fields (Application, Environment, _time, _raw)\n• Configuration issues (invalid repository name format)\n• Service connectivity problems (GitHub)\n• Insufficient permissions for GitHub repository access\n\nPlease check the error details above and verify:\n1. The raw Splunk JSON is properly formatted\n2. All required fields are present\n3. Your GitHub repository name is correct\n4. Your GitHub token has appropriate permissions`
          }]
        };
      }
    }
  );
}

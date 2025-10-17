import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseRawSplunkEvent, parseRawSplunkEventWithOpenAI } from './splunkParser.js';
import { findSuspectedCommits } from './commitAnalyzer.js';
import { GitHubService } from './githubService.js';
import { RawSplunkEvent, TriageInput, Commit } from './types.js';

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
    "Use OpenAI to parse raw Splunk JSON data and analyze GitHub commits to identify suspected root causes for production errors",
    {
      rawSplunkData: z.string().describe("Raw Splunk JSON string containing error details and stack trace"),
      repositoryName: z.string().describe("GitHub repository name in format 'owner/repo' (e.g., 'company/service-repo')"),
      commitLookbackDays: z.number().min(1).max(30).optional().describe("Number of days to look back for commits (1-30, default: 7)")
    },
    async ({ rawSplunkData, repositoryName, commitLookbackDays }) => {
      try {
        console.log(`\n🔍 Starting automated error triage with OpenAI-powered Splunk data parsing`);
        
        // Step 1: Parse the raw Splunk JSON data and extract structured triage input using OpenAI
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
        
        // Step 3: Analyze GitHub commits for potential root causes
        console.log('🔍 Step 3: Analyzing GitHub commits...');
        const commitLookbackDaysVal = commitLookbackDays || 7;
        const githubService = new GitHubService();
        
        let suspectedCommits: Commit[] = [];
        if (repositoryName) {
          try {
            const lookbackDate = new Date(Date.now() - (commitLookbackDaysVal * 24 * 60 * 60 * 1000)).toISOString();
            const recentCommits = await githubService.getCommitsSince(repositoryName, lookbackDate);
            
            console.log(`📊 Found ${recentCommits.length} recent commits to analyze`);
            
            // Use the structured error information for commit analysis
            const searchTerms = [
              triageInput.errorMessage,
              triageInput.exceptionType,
              ...triageInput.searchKeywords.files.map(f => f.replace('.cs', '')),
              ...triageInput.searchKeywords.methods,
              ...triageInput.searchKeywords.context
            ].join(' ');
            
            suspectedCommits = findSuspectedCommits(searchTerms, recentCommits);
            console.log(`🎯 Identified ${suspectedCommits.length} suspected commits`);
            
          } catch (githubError) {
            console.warn('⚠️  GitHub analysis failed:', githubError instanceof Error ? githubError.message : 'Unknown error');
          }
        } else {
          console.log('⚠️  No repository specified - skipping GitHub analysis');
        }
        
        // Step 4: Display analysis results
        console.log('\n📋 Analysis Results:');
        console.log('=' .repeat(50));
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
          console.log('\n🎯 Suspected Commits (Rollback Candidates):');
          suspectedCommits.slice(0, 5).forEach((commit, index) => {
            console.log(`\n  ${index + 1}. ${commit.hash.substring(0, 8)} - ${commit.message.split('\n')[0].substring(0, 80)}${commit.message.split('\n')[0].length > 80 ? '...' : ''}`);
            console.log(`     Author: ${commit.author}`);
            console.log(`     Date: ${new Date(commit.date).toLocaleString()}`);
            
            if (commit.changedFiles && commit.changedFiles.length > 0) {
              console.log(`     Files Changed (${commit.changedFiles.length}): ${commit.changedFiles.slice(0, 5).join(', ')}${commit.changedFiles.length > 5 ? '...' : ''}`);
            }
            
            if (commit.pullRequestUrl) {
              console.log(`     Pull Request: ${commit.pullRequestUrl}`);
            }
            
            // Show matching analysis
            const matchingFiles = commit.changedFiles?.filter(file => 
              triageInput.searchKeywords.files.some(errorFile => 
                file.toLowerCase().includes(errorFile.toLowerCase().replace('.cs', ''))
              )
            ) || [];
            
            if (matchingFiles.length > 0) {
              console.log(`     🔍 Files matching error: ${matchingFiles.join(', ')}`);
            }
          });
          
          console.log(`\n📊 Rollback Risk Assessment:`);
          console.log(`   • Total suspected commits: ${suspectedCommits.length}`);
          console.log(`   • Most recent suspect: ${new Date(suspectedCommits[0].date).toLocaleString()}`);
          console.log(`   • Files at risk: ${triageInput.searchKeywords.files.join(', ')}`);
        }
        
        // Build detailed commit analysis for return text
        let commitAnalysisText = '';
        if (suspectedCommits.length > 0) {
          commitAnalysisText = `\n\n**🎯 Rollback Candidates Analysis:**\n\n`;
          
          suspectedCommits.slice(0, 5).forEach((commit, index) => {
            const commitTitle = commit.message.split('\n')[0];
            const matchingFiles = commit.changedFiles?.filter(file => 
              triageInput.searchKeywords.files.some(errorFile => 
                file.toLowerCase().includes(errorFile.toLowerCase().replace('.cs', ''))
              )
            ) || [];
            
            commitAnalysisText += `**${index + 1}. Commit ${commit.hash.substring(0, 8)}**\n`;
            commitAnalysisText += `• **Message**: ${commitTitle}\n`;
            commitAnalysisText += `• **Author**: ${commit.author}\n`;
            commitAnalysisText += `• **Date**: ${new Date(commit.date).toLocaleString()}\n`;
            commitAnalysisText += `• **Files Changed**: ${commit.changedFiles?.length || 0} files\n`;
            
            if (commit.changedFiles && commit.changedFiles.length > 0) {
              commitAnalysisText += `• **Key Files**: ${commit.changedFiles.slice(0, 3).join(', ')}${commit.changedFiles.length > 3 ? '...' : ''}\n`;
            }
            
            if (matchingFiles.length > 0) {
              commitAnalysisText += `• **⚠️ Files Matching Error**: ${matchingFiles.join(', ')}\n`;
            }
            
            if (commit.pullRequestUrl) {
              commitAnalysisText += `• **Pull Request**: ${commit.pullRequestUrl}\n`;
            }
            
            commitAnalysisText += '\n';
          });
          
          commitAnalysisText += `**📊 Rollback Risk Assessment:**\n`;
          commitAnalysisText += `• **Total Suspected Commits**: ${suspectedCommits.length}\n`;
          commitAnalysisText += `• **Most Recent Suspect**: ${new Date(suspectedCommits[0].date).toLocaleString()}\n`;
          commitAnalysisText += `• **Critical Files at Risk**: ${triageInput.searchKeywords.files.join(', ')}\n`;
          commitAnalysisText += `• **Recommendation**: Review commits in order of suspicion for potential rollback\n`;
        }

        return {
          content: [{
            type: "text",
            text: `✅ **Triage Analysis Completed - Rollback Decision Support**\n\n**🔍 Service Details:**\n• **Application**: ${triageInput.serviceName}\n• **Environment**: ${triageInput.environment}\n• **Exception Type**: ${triageInput.exceptionType}\n• **Error Message**: ${triageInput.errorMessage}\n\n**📋 Technical Analysis:**\n• **Stack Frames Analyzed**: ${triageInput.stackTrace.length}\n• **Key Files Involved**: ${triageInput.searchKeywords.files.join(', ')}\n• **Critical Methods**: ${triageInput.searchKeywords.methods.join(', ')}\n• **Context Keywords**: ${triageInput.searchKeywords.context.join(', ')}\n• **GitHub Commits Analyzed**: ${suspectedCommits.length > 0 ? suspectedCommits.length : 'None (no repository specified)'}${commitAnalysisText}\n\n**🚀 Next Steps for Development Team:**\n1. **Review Suspected Commits**: Start with the highest-ranked commits above\n2. **Check File Overlap**: Focus on commits that modified files in the error stack trace\n3. **Assess Risk vs. Impact**: Consider rollback for recent commits with high file overlap\n4. **Test Hypothesis**: Use commit details and PR links to understand the changes\n5. **Decision Point**: Determine if rollback is safer than forward-fix based on change complexity\n\n${suspectedCommits.length > 0 ? 'This analysis provides specific commits ranked by relevance to help make informed rollback decisions.' : 'Enable GitHub analysis by providing a repository name to get rollback recommendations.'}`
          }]
        };
        
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

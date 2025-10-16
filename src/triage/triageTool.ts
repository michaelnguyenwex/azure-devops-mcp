import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseRawSplunkEvent } from './splunkParser.js';
import { findSuspectedCommits } from './commitAnalyzer.js';
import { GitHubService } from './githubService.js';
import { RawSplunkEvent, TriageInput, Commit } from './types.js';

/**
 * Registers the triage Splunk error tool with the MCP server.
 * 
 * This tool parses raw Splunk JSON data, extracts error information and stack traces,
 * then analyzes GitHub commits to identify potential root causes.
 * This is an analysis-only tool that does not create tickets.
 * 
 * @param server - The MCP server instance to register the tool with
 */
export function triageSplunkErrorTool(server: McpServer) {
  server.tool(
    "triage_splunk_error",
    "Parse raw Splunk JSON data and analyze GitHub commits to identify suspected root causes for production errors",
    {
      rawSplunkData: z.string().describe("Raw Splunk JSON string containing error details and stack trace"),
      repositoryName: z.string().describe("GitHub repository name in format 'owner/repo' (e.g., 'company/service-repo')"),
      commitLookbackDays: z.number().min(1).max(30).optional().describe("Number of days to look back for commits (1-30, default: 7)")
    },
    async ({ rawSplunkData, repositoryName, commitLookbackDays }) => {
      try {
        console.log(`\n🔍 Starting automated error triage with Splunk data parsing`);
        
        // Step 1: Parse the raw Splunk JSON data and extract structured triage input
        console.log('📋 Step 1: Parsing raw Splunk data and extracting error information...');
        const triageInput: TriageInput = await parseRawSplunkEvent(rawSplunkData);
        
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
          console.log('\n🎯 Suspected Commits:');
          suspectedCommits.slice(0, 5).forEach((commit, index) => {
            console.log(`  ${index + 1}. ${commit.hash.substring(0, 8)} - ${commit.message.substring(0, 80)}...`);
            console.log(`     Author: ${commit.author} | Date: ${commit.date}`);
          });
        }
        
        return {
          content: [{
            type: "text",
            text: `✅ Triage analysis completed successfully!\n\n**Service:** ${triageInput.serviceName}\n**Environment:** ${triageInput.environment}\n**Exception:** ${triageInput.exceptionType}\n**Error:** ${triageInput.errorMessage}\n\n**Analysis Results:**\n• Stack frames analyzed: ${triageInput.stackTrace.length}\n• Files involved: ${triageInput.searchKeywords.files.join(', ')}\n• Methods involved: ${triageInput.searchKeywords.methods.join(', ')}\n• GitHub commits analyzed: ${suspectedCommits.length > 0 ? suspectedCommits.length : 'None (no repository specified)'}\n\n**Key Investigation Points:**\n1. 🔍 **Stack Trace Analysis**: Focus on ${triageInput.stackTrace.length} stack frames, especially in files: ${triageInput.searchKeywords.files.slice(0, 3).join(', ')}\n2. 💻 **Method Analysis**: Key methods to investigate: ${triageInput.searchKeywords.methods.slice(0, 3).join(', ')}\n3. 📊 **Context Clues**: ${triageInput.searchKeywords.context.join(', ')}\n${suspectedCommits.length > 0 ? `4. 🎯 **Suspected Commits**: ${suspectedCommits.length} recent commits may be related to this error` : '4. 🎯 **GitHub Analysis**: Skipped (no repository specified)'}\n\nThis structured analysis provides clear starting points for manual investigation and can be used to create detailed Jira tickets.`
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

import { Commit, TriageInput } from './types.js';
import { getOpenAIConfig } from '../configStore.js';

// Type definitions for OpenAI response
interface CommitAnalysisResult {
  commit: Commit;
  relevanceScore: number;
  reasoning: string;
  rollbackRisk?: string;
  keyFactors?: string[];
}

/**
 * OpenAI-powered commit analyzer that uses semantic understanding
 * to identify commits related to production errors for rollback decisions.
 */
export class OpenAICommitAnalyzer {
  constructor() {
    // No constructor needed - configuration handled per request
  }

  /**
   * Analyzes commits using OpenAI to find those most likely related to the error.
   * Provides intelligent semantic matching and rollback risk assessment.
   */
  async findSuspectedCommitsWithAI(
    triageInput: TriageInput, 
    recentCommits: Commit[]
  ): Promise<CommitAnalysisResult[]> {
    
    if (!recentCommits || recentCommits.length === 0) {
      return [];
    }

    console.log(`🤖 Analyzing ${recentCommits.length} commits with OpenAI...`);

    // Prepare the analysis prompt
    const errorContext = this.buildErrorContext(triageInput);
    const commitData = this.formatCommitsForAnalysis(recentCommits);

    const prompt = `Act as an expert software engineer. Be methodical, data-driven, and concise.


ERROR CONTEXT:
${errorContext}

RECENT COMMITS TO ANALYZE:
${commitData}

**TASK:**
You will be given a production error context and a list of recent commits. Analyze EACH commit against the error context using the following criteria:
1.  **File Overlap**: Is there an overlap between files in the commit and files in the error's stack trace?
2.  **Functional Relevance**: Are the code changes semantically related to the error's function (e.g., authentication code for an authentication error)?
3.  **Timing**: How close was the commit to the error's first appearance?
4.  **Change Risk**: How risky is the change (e.g., refactor, dependency change, logic overhaul)?

**OUTPUT FORMAT:**
You MUST respond with ONLY a single, valid JSON object. Do not include any introductory text, markdown formatting, or explanations outside of the JSON structure.

The JSON object must adhere to this exact schema:
{
  "analysis": [
    {
      "commitHash": "string",
      "prLink": "string (URL to the Pull Request)",
      "relevanceScore": "integer (0-100)",
      "reasoning": "string (Brief, technical reasoning for the score)",
      "rollbackRisk": "string (Enum: 'HIGH', 'MEDIUM', 'LOW')",
      "keyFactors": "array of strings (e.g., ['file_overlap', 'recent_timing'])"
    }
  ],
  "summary": "string (A one-sentence technical summary for a rollback decision)"
}`;

    try {
      // Get OpenAI configuration
      const openAIConfig = await getOpenAIConfig();
      
      // Call OpenAI API using fetch (consistent with splunkParser approach)
      const response = await fetch(`${openAIConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'azure-gpt-4o-mini',
          messages: [
            {
              role: "system",
              content: "You are a highly specialized AI functioning as a code analysis engine. Your purpose is to determine the relevance of software commits to a given production error."
            },
            {
              role: "user", 
              content: prompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent analysis
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      const analysis = JSON.parse(responseData.choices[0].message.content || '{}');
      
      // Map the AI analysis back to our commit objects
      const results: CommitAnalysisResult[] = analysis.analysis?.map((item: any) => {
        const commit = recentCommits.find(c => c.hash.startsWith(item.commitHash.substring(0, 7)));
        return commit ? {
          commit,
          relevanceScore: item.relevanceScore,
          reasoning: item.reasoning,
          rollbackRisk: item.rollbackRisk,
          keyFactors: item.keyFactors
        } : null;
      }).filter((result: CommitAnalysisResult | null): result is CommitAnalysisResult => result !== null) || [];

      // Sort by relevance score
      results.sort((a: CommitAnalysisResult, b: CommitAnalysisResult) => b.relevanceScore - a.relevanceScore);

      console.log(`🎯 OpenAI identified ${results.length} relevant commits`);
      console.log(`📊 Summary: ${analysis.summary}`);

      return results;

    } catch (error) {
      console.error('❌ OpenAI commit analysis failed:', error);
      
      // Fallback to rule-based analysis if OpenAI fails
      console.log('🔄 Falling back to rule-based analysis...');
      return this.fallbackToRuleBasedAnalysis(triageInput, recentCommits);
    }
  }

  /**
   * Builds comprehensive error context for OpenAI analysis
   */
  private buildErrorContext(triageInput: TriageInput): string {
    const stackTraceFiles = triageInput.stackTrace.map(frame => frame.file).slice(0, 5);
    const stackTraceMethods = triageInput.stackTrace.map(frame => frame.method).slice(0, 5);

    return `Service: ${triageInput.serviceName}
Environment: ${triageInput.environment}
Error Type: ${triageInput.exceptionType}
Error Message: ${triageInput.errorMessage}
Key Files in Stack Trace: ${stackTraceFiles.join(', ')}
Key Methods in Stack Trace: ${stackTraceMethods.join(', ')}
Error Timestamp: ${triageInput.timestamp}
Context Keywords: ${triageInput.searchKeywords.context.join(', ')}`;
  }

  /**
   * Formats commits for OpenAI analysis
   */
  private formatCommitsForAnalysis(commits: Commit[]): string {
    return commits.map((commit, index) => {
      const commitAge = Math.floor((Date.now() - new Date(commit.date).getTime()) / (1000 * 60 * 60 * 24));
      
      return `${index + 1}. Commit: ${commit.hash.substring(0, 8)}
   Message: ${commit.message.split('\n')[0]}
   Author: ${commit.author}
   Age: ${commitAge} days ago
   Files Changed: ${commit.changedFiles?.join(', ') || 'N/A'}
   Pull Request: ${commit.pullRequestUrl || 'N/A'}`;
    }).join('\n\n');
  }

  /**
   * Fallback to rule-based analysis if OpenAI is unavailable
   */
  private fallbackToRuleBasedAnalysis(
    triageInput: TriageInput, 
    recentCommits: Commit[]
  ): CommitAnalysisResult[] {
    // Import and use the original rule-based logic as fallback
    return recentCommits.map(commit => ({
      commit,
      relevanceScore: 50, // Default moderate score
      reasoning: "Fallback analysis - OpenAI unavailable"
    }));
  }
}

/**
 * Factory function to create analyzer based on configuration
 */
export async function createCommitAnalyzer(useOpenAI: boolean = false): Promise<{
  analyzeSuspectedCommits: (triageInput: TriageInput, commits: Commit[]) => Promise<CommitAnalysisResult[]>
}> {
  if (useOpenAI) {
    const aiAnalyzer = new OpenAICommitAnalyzer();
    return {
      analyzeSuspectedCommits: (triageInput, commits) => aiAnalyzer.findSuspectedCommitsWithAI(triageInput, commits)
    };
  } else {
    // Use existing rule-based approach
    const { findSuspectedCommits } = await import('./commitAnalyzer.js');
    return {
      analyzeSuspectedCommits: async (triageInput, commits) => {
        const searchTerms = [
          triageInput.errorMessage,
          triageInput.exceptionType,
          ...triageInput.searchKeywords.files.map(f => f.replace('.cs', '')),
          ...triageInput.searchKeywords.methods,
          ...triageInput.searchKeywords.context
        ].join(' ');
        
        const suspectedCommits = findSuspectedCommits(searchTerms, commits);
        return suspectedCommits.map(commit => ({
          commit,
          relevanceScore: 75, // Assume rule-based found them for a reason
          reasoning: "Rule-based pattern matching"
        }));
      }
    };
  }
}

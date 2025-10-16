import { Commit } from './types.js';

/**
 * Service for retrieving GitHub commit information.
 * This class acts as a wrapper around existing MCP tools for GitHub data.
 */
export class GitHubService {
  /**
   * Retrieves commits from a repository since a specific date.
   * This helps identify recent changes that might be related to errors.
   * 
   * @param repoName - Name of the GitHub repository (e.g., 'owner/repo')
   * @param sinceDate - ISO date string to get commits since this date
   * @returns Promise resolving to array of commit information
   */
  async getCommitsSince(repoName: string, sinceDate: string): Promise<Commit[]> {
    try {
      // TODO: This should call the existing GitHub MCP tool
      // The actual implementation will depend on the available GitHub integration
      // This might involve calling GitHub API through existing MCP tools
      
      console.log(`Fetching commits for repository: ${repoName} since: ${sinceDate}`);
      
      // This is a placeholder - replace with actual MCP tool call
      // Example of what the actual implementation might look like:
      // const response = await this.callMCPTool('get_github_commits', { repoName, since: sinceDate });
      // return response.commits.map(commit => this.transformCommitData(commit));
      
      // Placeholder implementation - should be replaced with actual GitHub MCP calls
      const mockCommits: Commit[] = [
        {
          hash: 'abc123def456',
          message: 'Fix null pointer exception in user service',
          author: 'john.doe@company.com',
          date: sinceDate,
          changedFiles: ['src/services/userService.ts', 'tests/userService.test.ts'],
          pullRequestUrl: 'https://github.com/company/repo/pull/123'
        },
        {
          hash: 'def456ghi789',
          message: 'Update database connection settings',
          author: 'jane.smith@company.com',
          date: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          changedFiles: ['config/database.ts', 'src/db/connection.ts'],
          pullRequestUrl: 'https://github.com/company/repo/pull/124'
        }
      ];

      return mockCommits;
    } catch (error) {
      console.error(`Failed to retrieve commits for ${repoName}:`, error);
      throw new Error(`Unable to fetch GitHub commits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieves detailed information about a specific commit.
   * This can provide additional context about changes made in a commit.
   * 
   * @param repoName - Name of the GitHub repository
   * @param commitHash - The commit hash to retrieve details for
   * @returns Promise resolving to detailed commit information
   */
  async getCommitDetails(repoName: string, commitHash: string): Promise<Commit | null> {
    try {
      console.log(`Fetching commit details for: ${commitHash} in ${repoName}`);
      
      // TODO: Implement actual GitHub MCP tool call
      // Placeholder implementation
      return {
        hash: commitHash,
        message: 'Detailed commit message',
        author: 'developer@company.com',
        date: new Date().toISOString(),
        changedFiles: ['src/example.ts'],
        pullRequestUrl: `https://github.com/${repoName}/pull/123`
      };
    } catch (error) {
      console.error(`Failed to retrieve commit details for ${commitHash}:`, error);
      return null;
    }
  }

  /**
   * Searches for commits that might be related to specific keywords or file patterns.
   * This can help identify commits that might be related to specific errors or components.
   * 
   * @param repoName - Name of the GitHub repository
   * @param searchTerms - Array of terms to search for in commit messages and file paths
   * @param sinceDate - ISO date string to limit search scope
   * @returns Promise resolving to array of matching commits
   */
  async searchCommits(
    repoName: string, 
    searchTerms: string[], 
    sinceDate: string
  ): Promise<Commit[]> {
    try {
      const allCommits = await this.getCommitsSince(repoName, sinceDate);
      
      // Filter commits based on search terms
      return allCommits.filter(commit => {
        const searchText = `${commit.message} ${commit.changedFiles?.join(' ') || ''}`.toLowerCase();
        return searchTerms.some(term => searchText.includes(term.toLowerCase()));
      });
    } catch (error) {
      console.error(`Failed to search commits in ${repoName}:`, error);
      throw new Error(`Unable to search GitHub commits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

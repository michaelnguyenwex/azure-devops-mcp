import { Commit } from './types.js';
import axios from 'axios';

/**
 * Service for retrieving GitHub commit information.
 * This class integrates directly with the GitHub REST API.
 */
export class GitHubService {
  private readonly githubToken: string;
  private readonly baseUrl = 'https://api.github.com';

  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || '';
    
    if (!this.githubToken) {
      console.warn('⚠️  GitHub token not found. Set GITHUB_TOKEN or GITHUB_PAT environment variable for GitHub integration.');
    }
  }

  /**
   * Gets the authorization headers for GitHub API requests.
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'MCP-AZDO-Triage-Service/1.0.0'
    };

    if (this.githubToken) {
      headers['Authorization'] = `Bearer ${this.githubToken}`;
    }

    return headers;
  }
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
      if (!this.githubToken) {
        console.warn(`⚠️  No GitHub token configured. Returning empty commits list for ${repoName}`);
        return [];
      }

      console.log(`Fetching commits for repository: ${repoName} since: ${sinceDate}`);
      
      // GitHub API endpoint for commits
      const url = `${this.baseUrl}/repos/${repoName}/commits`;
      const params = {
        since: sinceDate,
        per_page: 100 // Limit to avoid too many results
      };

      const response = await axios.get(url, {
        headers: this.getAuthHeaders(),
        params
      });

      console.log(`✅ Retrieved ${response.data.length} commits from GitHub`);

      // Transform GitHub API response to our Commit interface
      const commits: Commit[] = await Promise.all(
        response.data.map(async (githubCommit: any) => {
          // Get changed files for each commit (requires separate API call)
          const changedFiles = await this.getCommitChangedFiles(repoName, githubCommit.sha);
          
          // Try to find associated pull request
          const pullRequestUrl = await this.findPullRequestForCommit(repoName, githubCommit.sha);

          return {
            hash: githubCommit.sha,
            message: githubCommit.commit.message,
            author: githubCommit.commit.author.email || githubCommit.author?.login || 'unknown',
            date: githubCommit.commit.author.date,
            changedFiles: changedFiles,
            pullRequestUrl: pullRequestUrl
          };
        })
      );

      return commits;
    } catch (error) {
      console.error(`Failed to retrieve commits for ${repoName}:`, error);
      
      // If it's a 404, the repo might not exist or we don't have access
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.warn(`Repository ${repoName} not found or not accessible. Check repository name and GitHub token permissions.`);
        return [];
      }
      
      // If it's a 403, we might have hit rate limits or don't have permission
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        console.warn(`GitHub API access forbidden for ${repoName}. Check GitHub token permissions or rate limits.`);
        return [];
      }

      // For other errors, still return empty array but log the issue
      console.warn(`GitHub API error for ${repoName}, continuing without commit data:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Gets the files changed in a specific commit.
   */
  private async getCommitChangedFiles(repoName: string, commitSha: string): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/repos/${repoName}/commits/${commitSha}`;
      
      const response = await axios.get(url, {
        headers: this.getAuthHeaders()
      });

      return response.data.files?.map((file: any) => file.filename) || [];
    } catch (error) {
      console.warn(`Failed to get changed files for commit ${commitSha}:`, error);
      return [];
    }
  }

  /**
   * Attempts to find the pull request associated with a commit.
   */
  private async findPullRequestForCommit(repoName: string, commitSha: string): Promise<string | undefined> {
    try {
      // Search for pull requests that contain this commit
      const url = `${this.baseUrl}/repos/${repoName}/commits/${commitSha}/pulls`;
      
      const response = await axios.get(url, {
        headers: this.getAuthHeaders()
      });

      // Return the first (most relevant) pull request URL
      if (response.data && response.data.length > 0) {
        return response.data[0].html_url;
      }

      return undefined;
    } catch (error) {
      // This is not critical, so just return undefined if it fails
      return undefined;
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
      if (!this.githubToken) {
        console.warn(`⚠️  No GitHub token configured. Cannot fetch commit details for ${commitHash}`);
        return null;
      }

      console.log(`Fetching commit details for: ${commitHash} in ${repoName}`);
      
      const url = `${this.baseUrl}/repos/${repoName}/commits/${commitHash}`;
      
      const response = await axios.get(url, {
        headers: this.getAuthHeaders()
      });

      const githubCommit = response.data;
      const pullRequestUrl = await this.findPullRequestForCommit(repoName, commitHash);

      return {
        hash: githubCommit.sha,
        message: githubCommit.commit.message,
        author: githubCommit.commit.author.email || githubCommit.author?.login || 'unknown',
        date: githubCommit.commit.author.date,
        changedFiles: githubCommit.files?.map((file: any) => file.filename) || [],
        pullRequestUrl: pullRequestUrl
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

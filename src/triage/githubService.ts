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

  /**
   * Retrieves pull request details including title, description, and metadata.
   * 
   * @param repoName - Name of the GitHub repository (e.g., 'owner/repo')
   * @param pullNumber - The pull request number
   * @returns Promise resolving to pull request details
   */
  async getPullRequestDetails(repoName: string, pullNumber: number): Promise<{
    number: number;
    title: string;
    description: string;
    state: string;
    htmlUrl: string;
    createdAt: string;
    updatedAt: string;
    mergedAt: string | null;
    author: string;
    repoName: string;
  } | null> {
    try {
      if (!this.githubToken) {
        console.warn(`⚠️  No GitHub token configured. Cannot fetch PR details for #${pullNumber}`);
        return null;
      }

      console.log(`Fetching PR #${pullNumber} details from ${repoName}`);
      
      const url = `${this.baseUrl}/repos/${repoName}/pulls/${pullNumber}`;
      
      const response = await axios.get(url, {
        headers: this.getAuthHeaders()
      });

      const pr = response.data;

      return {
        number: pr.number,
        title: pr.title,
        description: pr.body || '',
        state: pr.state,
        htmlUrl: pr.html_url,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        author: pr.user?.login || 'unknown',
        repoName: repoName
      };
    } catch (error) {
      console.error(`Failed to retrieve PR #${pullNumber} details:`, error);
      return null;
    }
  }

  /**
   * Parses a GitHub PR URL to extract owner, repo, and PR number.
   * Supports formats:
   * - https://github.com/owner/repo/pull/123
   * - https://github.com/owner/repo/pulls/123
   * 
   * @param prUrl - The GitHub PR URL
   * @returns Object with owner, repo, and pullNumber, or null if invalid
   */
  private parsePullRequestUrl(prUrl: string): { owner: string; repo: string; pullNumber: number; fullRepoName: string } | null {
    try {
      const url = new URL(prUrl);
      
      // Expected format: /owner/repo/pull/123 or /owner/repo/pulls/123
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      
      if (pathParts.length >= 4 && (pathParts[2] === 'pull' || pathParts[2] === 'pulls')) {
        const owner = pathParts[0];
        const repo = pathParts[1];
        const pullNumber = parseInt(pathParts[3], 10);
        
        if (!isNaN(pullNumber)) {
          return {
            owner,
            repo,
            pullNumber,
            fullRepoName: `${owner}/${repo}`
          };
        }
      }
      
      console.warn(`Invalid PR URL format: ${prUrl}`);
      return null;
    } catch (error) {
      console.error(`Failed to parse PR URL: ${prUrl}`, error);
      return null;
    }
  }

  /**
   * Gets the contents of a file from a GitHub repository.
   * 
   * @param repoName - Name of the GitHub repository (e.g., 'owner/repo')
   * @param filePath - Path to the file in the repository
   * @param branch - Branch name (defaults to 'main')
   * @returns Promise resolving to file content as string
   */
  private async getFileContents(repoName: string, filePath: string, branch: string = 'main'): Promise<string | null> {
    try {
      if (!this.githubToken) {
        console.warn(`⚠️  No GitHub token configured. Cannot fetch file contents`);
        return null;
      }

      const url = `${this.baseUrl}/repos/${repoName}/contents/${filePath}`;
      
      const response = await axios.get(url, {
        headers: this.getAuthHeaders(),
        params: { ref: branch }
      });

      // GitHub returns base64 encoded content
      if (response.data.content) {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.warn(`File not found: ${filePath} in ${repoName}`);
      } else {
        console.error(`Failed to get file contents for ${filePath}:`, error);
      }
      return null;
    }
  }

  /**
   * Lists directories in a repository path.
   * 
   * @param repoName - Name of the GitHub repository (e.g., 'owner/repo')
   * @param path - Path to list (empty string for root)
   * @param branch - Branch name (defaults to 'main')
   * @returns Promise resolving to array of directory names
   */
  private async listDirectories(repoName: string, path: string = '', branch: string = 'main'): Promise<string[]> {
    try {
      if (!this.githubToken) {
        console.warn(`⚠️  No GitHub token configured. Cannot list directories`);
        return [];
      }

      const url = `${this.baseUrl}/repos/${repoName}/contents/${path}`;
      
      const response = await axios.get(url, {
        headers: this.getAuthHeaders(),
        params: { ref: branch }
      });

      // Filter for directories only
      if (Array.isArray(response.data)) {
        return response.data
          .filter((item: any) => item.type === 'dir')
          .map((item: any) => item.name);
      }

      return [];
    } catch (error) {
      console.error(`Failed to list directories at ${path}:`, error);
      return [];
    }
  }

  /**
   * Automates the process of finding the AppName from health-benefits-app-config repo.
   * 
   * Workflow:
   * 1. Parse the PR URL to extract the source repo name
   * 2. Search health-benefits-app-config repo for a folder matching the repo name
   * 3. Navigate to the qa folder and read wexhealth.host.json
   * 4. Extract and return the AppName value
   * 
   * @param prUrl - The GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)
   * @param configRepoOwner - Owner of the config repo (defaults to the same owner as PR)
   * @param configRepoName - Name of the config repo (defaults to 'health-benefits-app-config')
   * @param branch - Branch to search in config repo (defaults to 'main')
   * @returns Promise resolving to AppName value or null if not found
   */
  async getAppNameFromPR(
    prUrl: string,
    configRepoOwner?: string,
    configRepoName: string = 'health-benefits-app-config',
    branch: string = 'main'
  ): Promise<{
    appName: string;
    repoName: string;
    configPath: string;
    prDetails?: {
      number: number;
      title: string;
      description: string;
    };
  } | null> {
    try {
      console.log(`\n🔍 Starting AppName lookup from PR: ${prUrl}`);
      
      // Step 1: Parse PR URL to get repo name
      const prInfo = this.parsePullRequestUrl(prUrl);
      if (!prInfo) {
        console.error('❌ Failed to parse PR URL');
        return null;
      }

      console.log(`✅ Extracted repo name: ${prInfo.repo}`);

      // Optionally get PR details for additional context
      const prDetails = await this.getPullRequestDetails(prInfo.fullRepoName, prInfo.pullNumber);

      // Step 2: Use the PR's owner as config repo owner if not specified
      const configOwner = configRepoOwner || prInfo.owner;
      const fullConfigRepo = `${configOwner}/${configRepoName}`;
      
      console.log(`🔍 Searching in config repo: ${fullConfigRepo}`);

      // Step 3: List directories in config repo to find matching folder
      const directories = await this.listDirectories(fullConfigRepo, '', branch);
      
      console.log(`📁 Found ${directories.length} directories in config repo`);

      // Look for folder matching the repo name
      // Try multiple naming patterns:
      // 1. Exact match: health-cdh-authservice
      // 2. Remove 'health-' prefix and add '-az-cd' suffix: cdh-authservice-az-cd
      // 3. Just remove 'health-' prefix: cdh-authservice
      // 4. Just add '-az-cd' suffix: health-cdh-authservice-az-cd
      const possibleNames = [
        prInfo.repo,  // Exact match
        prInfo.repo.replace(/^health-/, '') + '-az-cd',  // Remove health- prefix, add -az-cd suffix
        prInfo.repo.replace(/^health-/, ''),  // Just remove health- prefix
        prInfo.repo + '-az-cd'  // Just add -az-cd suffix
      ];

      let matchingFolder: string | undefined;
      for (const name of possibleNames) {
        matchingFolder = directories.find(dir => dir === name);
        if (matchingFolder) {
          console.log(`✅ Found matching folder: ${matchingFolder} (matched pattern: ${name})`);
          break;
        }
      }
      
      if (!matchingFolder) {
        console.warn(`⚠️  No matching folder found for repo: ${prInfo.repo}`);
        console.log(`   Tried patterns: ${possibleNames.join(', ')}`);
        console.log(`   Available folders: ${directories.slice(0, 20).join(', ')}...`);
        return null;
      }

      // Step 4: Construct path to wexhealth.host.json in qa folder
      const configPath = `${matchingFolder}/qa/wexhealth.host.json`;
      console.log(`📄 Reading config file: ${configPath}`);

      // Step 5: Get file contents
      const fileContents = await this.getFileContents(fullConfigRepo, configPath, branch);
      
      if (!fileContents) {
        console.warn(`⚠️  Could not read file: ${configPath}`);
        return null;
      }

      // Step 6: Parse JSON and extract AppName
      const config = JSON.parse(fileContents);
      
      // AppName can be at root level or nested in HostResources
      const appName = config.AppName || config.HostResources?.AppName;
      
      if (!appName) {
        console.warn(`⚠️  No AppName field found in ${configPath}`);
        console.warn(`   Available root fields: ${Object.keys(config).join(', ')}`);
        return null;
      }

      console.log(`✅ Found AppName: ${appName}`);

      return {
        appName: appName,
        repoName: prInfo.repo,
        configPath: configPath,
        prDetails: prDetails ? {
          number: prDetails.number,
          title: prDetails.title,
          description: prDetails.description
        } : undefined
      };

    } catch (error) {
      console.error('❌ Failed to get AppName from PR:', error);
      if (error instanceof SyntaxError) {
        console.error('   JSON parsing error - check file format');
      }
      return null;
    }
  }
 }

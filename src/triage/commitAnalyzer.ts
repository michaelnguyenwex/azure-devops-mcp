import { Commit } from './types.js';

/**
 * Analyzes commits to find those that might be related to specific errors.
 * This function extracts keywords from error messages and searches for them
 * in commit messages and changed file paths.
 * 
 * @param errorMessage - The error message to extract keywords from
 * @param recentCommits - Array of recent commits to analyze
 * @returns Array of commits that are suspected to be related to the error
 */
export function findSuspectedCommits(errorMessage: string, recentCommits: Commit[]): Commit[] {
  if (!errorMessage || !recentCommits || recentCommits.length === 0) {
    return [];
  }

  const keywords = extractKeywordsFromError(errorMessage);
  const suspectedCommits: Array<{ commit: Commit; score: number }> = [];

  for (const commit of recentCommits) {
    const score = calculateRelevanceScore(commit, keywords, errorMessage);
    if (score > 0) {
      suspectedCommits.push({ commit, score });
    }
  }

  // Sort by relevance score (highest first) and return the commits
  return suspectedCommits
    .sort((a, b) => b.score - a.score)
    .map(item => item.commit);
}

/**
 * Extracts relevant keywords from an error message that might appear in commits.
 * This includes class names, method names, file paths, and important terms.
 * 
 * @param errorMessage - The error message to analyze
 * @returns Array of extracted keywords
 */
function extractKeywordsFromError(errorMessage: string): string[] {
  const keywords: Set<string> = new Set();

  // Extract Java/C# class names and method names (e.g., "com.example.UserService.getUserById")
  const javaPattern = /([a-z]+\.)*[A-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)?/g;
  let match;
  while ((match = javaPattern.exec(errorMessage)) !== null) {
    const fullPath = match[0];
    const parts = fullPath.split('.');
    
    // Add the class name (last part before method)
    if (parts.length >= 2) {
      keywords.add(parts[parts.length - 2]);
    }
    
    // Add the method name (last part)
    keywords.add(parts[parts.length - 1]);
    
    // Add the full path
    keywords.add(fullPath);
  }

  // Extract file paths and extensions
  const filePattern = /\b[\w-]+\.(java|ts|js|py|cs|php|rb|go|cpp|c)\b/gi;
  while ((match = filePattern.exec(errorMessage)) !== null) {
    keywords.add(match[0]);
    // Also add the filename without extension
    const filename = match[0].split('.')[0];
    keywords.add(filename);
  }

  // Extract camelCase and PascalCase identifiers
  const camelCasePattern = /\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g;
  while ((match = camelCasePattern.exec(errorMessage)) !== null) {
    keywords.add(match[0]);
  }

  const pascalCasePattern = /\b[A-Z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g;
  while ((match = pascalCasePattern.exec(errorMessage)) !== null) {
    keywords.add(match[0]);
  }

  // Extract database-related terms
  const dbPattern = /\b(table|column|index|constraint|foreign_key|primary_key|database|schema)[\s_-]*\w+\b/gi;
  while ((match = dbPattern.exec(errorMessage)) !== null) {
    keywords.add(match[0]);
  }

  // Extract specific error-related keywords that might appear in commit messages
  const errorKeywords = [
    'null', 'undefined', 'exception', 'error', 'fail', 'timeout', 'connection',
    'authentication', 'authorization', 'permission', 'access', 'denied',
    'invalid', 'missing', 'not found', 'cannot', 'unable', 'refused'
  ];

  for (const keyword of errorKeywords) {
    if (errorMessage.toLowerCase().includes(keyword)) {
      keywords.add(keyword);
    }
  }

  // Extract URLs and endpoints
  const urlPattern = /\b(https?:\/\/[\w.-]+(?:\/[\w.-]*)*|\/(api|v\d+)\/[\w\/.-]*)\b/g;
  while ((match = urlPattern.exec(errorMessage)) !== null) {
    keywords.add(match[0]);
    
    // Extract path segments
    const pathParts = match[0].split('/').filter(part => part && !part.startsWith('http'));
    pathParts.forEach(part => keywords.add(part));
  }

  // Remove very short or common words that aren't useful
  const filteredKeywords = Array.from(keywords).filter(keyword => {
    const lower = keyword.toLowerCase();
    return keyword.length > 2 && 
           !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'but', 'day', 'get', 'use', 'man', 'new', 'now', 'old', 'see', 'him', 'two', 'how', 'its', 'who', 'oil', 'sit', 'set', 'run', 'eat', 'far', 'sea', 'eye'].includes(lower);
  });

  return filteredKeywords;
}

/**
 * Calculates a relevance score for a commit based on how well it matches
 * the extracted keywords and error context.
 * 
 * @param commit - The commit to analyze
 * @param keywords - Keywords extracted from the error message
 * @param errorMessage - Original error message for additional context
 * @returns Numeric score indicating relevance (higher = more relevant)
 */
function calculateRelevanceScore(commit: Commit, keywords: string[], errorMessage: string): number {
  let score = 0;
  const commitText = `${commit.message} ${commit.changedFiles?.join(' ') || ''}`.toLowerCase();
  const errorLower = errorMessage.toLowerCase();

  // High-value matches in commit message
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    
    if (commit.message.toLowerCase().includes(keywordLower)) {
      score += 10; // High score for keyword in commit message
      
      // Extra points if it's in the commit title (first line)
      const commitTitle = commit.message.split('\n')[0].toLowerCase();
      if (commitTitle.includes(keywordLower)) {
        score += 5;
      }
    }

    // Medium-value matches in changed files
    if (commit.changedFiles) {
      for (const file of commit.changedFiles) {
        if (file.toLowerCase().includes(keywordLower)) {
          score += 5; // Medium score for keyword in file path
        }
      }
    }
  }

  // Look for common fix patterns in commit messages
  const fixPatterns = [
    /\bfix(es|ed)?\b/i,
    /\brepair(s|ed)?\b/i,
    /\bresolve(s|d)?\b/i,
    /\bpatch(es|ed)?\b/i,
    /\bcorrect(s|ed)?\b/i,
    /\baddress(es|ed)?\b/i,
    /\bhandle(s|d)?\b/i
  ];

  for (const pattern of fixPatterns) {
    if (pattern.test(commit.message)) {
      score += 3; // Bonus for commits that look like fixes
    }
  }

  // Look for error-related terms in commit message
  const errorTerms = ['error', 'exception', 'fail', 'bug', 'issue', 'problem', 'crash'];
  for (const term of errorTerms) {
    if (commitText.includes(term) && errorLower.includes(term)) {
      score += 4;
    }
  }

  // Recent commits get slight priority
  const commitAge = Date.now() - new Date(commit.date).getTime();
  const daysSinceCommit = commitAge / (1000 * 60 * 60 * 24);
  
  if (daysSinceCommit <= 1) {
    score += 2; // Very recent commits
  } else if (daysSinceCommit <= 7) {
    score += 1; // Recent commits
  }

  return score;
}

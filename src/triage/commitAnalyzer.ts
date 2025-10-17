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
 * the extracted keywords and error context. Enhanced for rollback decision support.
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

  // CRITICAL: Exact file name matches (highest priority for rollback)
  if (commit.changedFiles) {
    for (const file of commit.changedFiles) {
      const fileName = file.toLowerCase();
      
      // Extract file names from keywords and check for exact or partial matches
      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        
        // Exact file name match (without extension)
        if (keywordLower.endsWith('.cs') || keywordLower.endsWith('.js') || keywordLower.endsWith('.ts')) {
          const keywordFileName = keywordLower.split('/').pop()?.replace(/\.(cs|js|ts)$/, '') || keywordLower;
          const commitFileName = fileName.split('/').pop()?.replace(/\.(cs|js|ts)$/, '') || fileName;
          
          if (commitFileName === keywordFileName) {
            score += 50; // VERY HIGH score for exact file match
          } else if (commitFileName.includes(keywordFileName) || keywordFileName.includes(commitFileName)) {
            score += 30; // HIGH score for partial file match
          }
        }
        
        // Class/Controller name matches
        if (fileName.includes(keywordLower)) {
          score += 25; // HIGH score for file path containing keyword
        }
      }
    }
  }

  // HIGH: Method name matches in commit message (good rollback indicator)
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    
    if (commit.message.toLowerCase().includes(keywordLower)) {
      // Check if it's likely a method name (CamelCase or contains parentheses)
      if (/^[a-z][a-zA-Z0-9]*[A-Z]/.test(keyword) || keyword.includes('(')) {
        score += 20; // HIGH score for method names in commit message
      } else {
        score += 10; // Medium score for other keywords
      }
      
      // Extra bonus if it's in the commit title (first line)
      const commitTitle = commit.message.split('\n')[0].toLowerCase();
      if (commitTitle.includes(keywordLower)) {
        score += 8;
      }
    }
  }

  // ENHANCED: Context-aware scoring based on error type
  const errorType = extractErrorType(errorMessage);
  const contextualKeywords = getContextualKeywords(errorType);
  
  for (const contextKeyword of contextualKeywords) {
    if (commitText.includes(contextKeyword.toLowerCase())) {
      score += 15; // HIGH score for context-relevant terms
    }
  }

  // ENHANCED: Look for risky change patterns in commit messages (rollback candidates)
  const riskyPatterns = [
    /\brefactor(ed|ing)?\b/i,
    /\brewrite\b/i,
    /\bmajor\s+change/i,
    /\bbreaking\s+change/i,
    /\bauth(entication|orization)\b/i,
    /\bsecurity\b/i,
    /\bmiddleware\b/i,
    /\bpipeline\b/i
  ];

  for (const pattern of riskyPatterns) {
    if (pattern.test(commit.message)) {
      score += 12; // HIGH bonus for potentially risky changes
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
      score += 8; // Medium bonus for commits that look like fixes
    }
  }

  // Look for error-related terms in commit message
  const errorTerms = ['error', 'exception', 'fail', 'bug', 'issue', 'problem', 'crash'];
  for (const term of errorTerms) {
    if (commitText.includes(term) && errorLower.includes(term)) {
      score += 6;
    }
  }

  // ENHANCED: Recent commits get higher priority for rollback consideration
  const commitAge = Date.now() - new Date(commit.date).getTime();
  const daysSinceCommit = commitAge / (1000 * 60 * 60 * 24);
  
  if (daysSinceCommit <= 1) {
    score += 10; // Very recent commits (prime rollback candidates)
  } else if (daysSinceCommit <= 3) {
    score += 6; // Recent commits  
  } else if (daysSinceCommit <= 7) {
    score += 3; // Week-old commits
  }

  return score;
}

/**
 * Extracts the error type from the error message to help with contextual scoring
 */
function extractErrorType(errorMessage: string): string {
  const authPatterns = /authentication|authorization|auth|unauthorized|unauthenticated|access.*denied/i;
  const nullPatterns = /null.*reference|null.*pointer|nullpointer|object.*null/i;
  const connectionPatterns = /connection|timeout|network|socket|http/i;
  const validationPatterns = /validation|invalid|format|parse|convert/i;
  
  if (authPatterns.test(errorMessage)) return 'authentication';
  if (nullPatterns.test(errorMessage)) return 'null_reference';
  if (connectionPatterns.test(errorMessage)) return 'connection';
  if (validationPatterns.test(errorMessage)) return 'validation';
  
  return 'general';
}

/**
 * Gets contextual keywords based on error type for better matching
 */
function getContextualKeywords(errorType: string): string[] {
  switch (errorType) {
    case 'authentication':
      return ['auth', 'login', 'token', 'jwt', 'oauth', 'security', 'middleware', 'claims', 'principal', 'signin', 'signout'];
    case 'null_reference':  
      return ['null', 'check', 'validation', 'guard', 'defensive', 'nullable'];
    case 'connection':
      return ['http', 'client', 'timeout', 'retry', 'connection', 'network', 'api'];
    case 'validation':
      return ['validate', 'parse', 'convert', 'format', 'check', 'model', 'binding'];
    default:
      return ['error', 'exception', 'handle', 'try', 'catch'];
  }
}

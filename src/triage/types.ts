/**
 * Interface representing a single error log event from Splunk
 */
export interface SplunkLogEvent {
  /** Timestamp when the error occurred */
  _time: string;
  
  /** The error message content */
  message: string;
  
  /** The service/application that generated the error */
  source?: string;
  
  /** The environment where the error occurred (e.g., 'prod', 'staging') */
  environment?: string;
  
  /** The service name that generated the error */
  serviceName?: string;
  
  /** Log level (ERROR, WARN, etc.) */
  level?: string;
  
  /** Additional metadata fields */
  [key: string]: any;
}

/**
 * Interface representing deployment information for a service
 */
export interface DeploymentInfo {
  /** The git commit hash that was deployed */
  commitHash: string;
  
  /** When the deployment occurred */
  deployedAt?: string;
  
  /** Version or tag information */
  version?: string;
  
  /** Environment where it's deployed */
  environment?: string;
}

/**
 * Interface representing a git commit
 */
export interface Commit {
  /** The commit hash */
  hash: string;
  
  /** The commit message */
  message: string;
  
  /** Author information */
  author: string;
  
  /** Commit date */
  date: string;
  
  /** List of files changed in this commit */
  changedFiles?: string[];
  
  /** URL to the pull request (if available) */
  pullRequestUrl?: string;
}

/**
 * Interface encapsulating all data needed for creating a triage ticket
 */
export interface TriageData {
  /** The normalized error signature */
  errorSignature: string;
  
  /** Number of times this error occurred */
  errorCount: number;
  
  /** Link to view the error in Splunk */
  splunkLink: string;
  
  /** The original error message */
  errorMessage: string;
  
  /** When the error was first seen */
  firstSeen: string;
  
  /** List of commits suspected to be related to the error */
  suspectedCommits: Commit[];
  
  /** Service and environment information */
  serviceName: string;
  environment: string;
  
  /** Deployment information for the running service */
  deploymentInfo?: DeploymentInfo;
}

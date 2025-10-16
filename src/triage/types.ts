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
 * Interface representing a raw Splunk event that needs to be parsed
 */
export interface RawSplunkEvent {
  /** Raw JSON string containing the parsed log data */
  _raw: string;
  
  /** The application that generated the error */
  Application: string;
  
  /** The environment where the error occurred */
  Environment: string;
  
  /** Timestamp when the error occurred */
  _time: string;
}

/**
 * Interface representing the parsed contents of the _raw JSON string
 */
export interface ParsedRawData {
  /** Timestamp in ISO format */
  '@t': string;
  
  /** Message template containing stack trace information */
  '@mt': string;
  
  /** Exception details and stack trace */
  '@x': string;
  
  /** Additional fields that may be present */
  [key: string]: any;
}

/**
 * Interface representing a single stack trace frame
 */
export interface StackFrame {
  /** The file name where the error occurred */
  file: string;
  
  /** The method name where the error occurred */
  method: string;
  
  /** The line number where the error occurred (may be null) */
  line: number | null;
}

/**
 * Interface representing search keywords extracted from the error
 */
export interface SearchKeywords {
  /** Unique list of file names involved */
  files: string[];
  
  /** Unique list of method names involved */
  methods: string[];
  
  /** Additional context keywords */
  context: string[];
}

/**
 * Interface representing the structured input for the triage system
 */
export interface TriageInput {
  /** The service name that generated the error */
  serviceName: string;
  
  /** The environment where the error occurred */
  environment: string;
  
  /** ISO timestamp when the error occurred */
  timestamp: string;
  
  /** The primary error message */
  errorMessage: string;
  
  /** The type/class of the exception */
  exceptionType: string;
  
  /** Parsed stack trace frames */
  stackTrace: StackFrame[];
  
  /** Keywords for searching related code */
  searchKeywords: SearchKeywords;
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

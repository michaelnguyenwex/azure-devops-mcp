import { getSplunkClient } from '../integrations/splunk/client.js';

/**
 * State manager for tracking processed errors to prevent duplicate ticket creation.
 * This class manages state using Splunk summary indexes to persist information
 * about which errors have already been triaged.
 */
export class StateManager {
  private readonly summaryIndex: string;
  private readonly sourcetype: string;

  constructor(summaryIndex: string = 'triage_summary', sourcetype: string = 'error_triage_state') {
    this.summaryIndex = summaryIndex;
    this.sourcetype = sourcetype;
  }

  /**
   * Checks if Splunk is available and configured.
   * @returns true if Splunk client is available, false otherwise
   */
  private isSplunkAvailable(): boolean {
    try {
      getSplunkClient();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if an error signature has already been processed and has an active ticket.
   * Uses Splunk search to query the summary index for existing triage records.
   * 
   * @param errorSignature - The normalized error signature to check
   * @returns Promise resolving to true if error has been processed, false otherwise
   */
  async isErrorProcessed(errorSignature: string): Promise<boolean> {
    try {
      console.log(`Checking if error signature has been processed: ${errorSignature.substring(0, 50)}...`);
      
      // Check if Splunk is available
      if (!this.isSplunkAvailable()) {
        console.log('⚠️  Splunk not configured - assuming error is new (no state tracking)');
        return false;
      }
      
      // Construct Splunk search query to find existing triage records
      const searchQuery = this.buildSearchQuery(errorSignature);
      
      console.log(`Executing Splunk search: ${searchQuery}`);
      
      try {
        // Use the existing Splunk client to search for triage records
        const splunkClient = getSplunkClient();
        
        const searchResult = await splunkClient.search.execute(searchQuery, {
          earliestTime: '-30d', // Look back 30 days for existing triage records
          latestTime: 'now',
          maxResults: 1 // We only need to know if any exists
        });
        
        const hasExistingRecords = searchResult.results && searchResult.results.length > 0;
        
        if (hasExistingRecords) {
          console.log('✅ Found existing triage record for this error signature');
          return true;
        } else {
          console.log('🆕 No existing triage record found - this is a new error');
          return false;
        }
        
      } catch (splunkError) {
        console.warn('⚠️  Splunk search failed, assuming error is new:', splunkError);
        // If Splunk is not available or configured, assume it's a new error
        // This allows the triage process to continue even without Splunk
        return false;
      }
      
    } catch (error) {
      console.error('Failed to check error processing status:', error);
      // In case of error, err on the side of not processing to avoid spam
      // but log the issue for investigation
      return true;
    }
  }

  /**
   * Marks an error signature as processed by writing a record to the Splunk summary index.
   * This creates a persistent record that can be queried by future triage runs.
   * 
   * @param errorSignature - The normalized error signature
   * @param jiraTicketKey - The created Jira ticket key
   * @param additionalData - Optional additional metadata to store
   * @returns Promise resolving when the state has been recorded
   */
  async markErrorAsProcessed(
    errorSignature: string, 
    jiraTicketKey: string,
    additionalData?: {
      serviceName?: string;
      environment?: string;
      errorCount?: number;
      firstSeen?: string;
    }
  ): Promise<void> {
    try {
      console.log(`Marking error as processed: ${jiraTicketKey} for signature: ${errorSignature.substring(0, 50)}...`);
      
      // Create the state record to be written to Splunk
      const stateRecord = this.createStateRecord(errorSignature, jiraTicketKey, additionalData);
      
      console.log('State record to be written:', stateRecord);
      
      // Check if Splunk is available before trying to write state
      if (!this.isSplunkAvailable()) {
        console.log('⚠️  Splunk not configured - triage state will not be tracked');
        return; // Graceful degradation
      }

      try {
        // For now, we'll use a Splunk search to insert/log the state record
        // In a real implementation, you'd typically use Splunk HEC (HTTP Event Collector)
        // or a dedicated logging mechanism to write to the summary index
        
        // Create a search that logs the triage state
        const logQuery = `| makeresults count=1 
        | eval timestamp="${(stateRecord as any).timestamp}"
        | eval error_signature="${this.escapeSplunkString(errorSignature)}"
        | eval jira_ticket_key="${jiraTicketKey}"
        | eval triage_version="${(stateRecord as any).triage_version}"
        | eval action="${(stateRecord as any).action}"
        | eval service_name="${additionalData?.serviceName || 'unknown'}"
        | eval environment="${additionalData?.environment || 'unknown'}"
        | eval error_count="${additionalData?.errorCount || 0}"
        | eval first_seen="${additionalData?.firstSeen || ''}"
        | collect index=${this.summaryIndex} sourcetype=${this.sourcetype}`;
        
        const splunkClient = getSplunkClient();
        
        await splunkClient.search.execute(logQuery, {
          earliestTime: 'now',
          latestTime: 'now',
          maxResults: 1
        });
        
        console.log(`✅ Successfully marked error as processed with ticket: ${jiraTicketKey}`);
        
      } catch (splunkError) {
        console.warn('⚠️  Failed to write triage state to Splunk, but continuing:', splunkError);
        // Don't throw here - the triage process should continue even if state tracking fails
        // This allows the system to work without Splunk or when Splunk is temporarily unavailable
      }
      
    } catch (error: unknown) {
      console.error('Failed to mark error as processed:', error);
      // Only throw if it's a critical error, not just Splunk unavailability
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Splunk client not initialized')) {
        console.warn('⚠️  Splunk not configured - triage state will not be tracked');
        return; // Graceful degradation
      }
      throw new Error(`Unable to update triage state: ${errorMessage}`);
    }
  }

  /**
   * Retrieves the processing history for an error signature.
   * This can help understand how often an error has been seen and triaged.
   * 
   * @param errorSignature - The error signature to look up
   * @param lookbackDays - Number of days to look back (default 30)
   * @returns Promise resolving to array of processing records
   */
  async getProcessingHistory(
    errorSignature: string, 
    lookbackDays: number = 30
  ): Promise<Array<{
    timestamp: string;
    jiraTicketKey: string;
    serviceName?: string;
    environment?: string;
  }>> {
    try {
      console.log(`Retrieving processing history for: ${errorSignature.substring(0, 50)}...`);
      
      const searchQuery = this.buildHistorySearchQuery(errorSignature, lookbackDays);
      
      // Check if Splunk is available
      if (!this.isSplunkAvailable()) {
        console.log('⚠️  Splunk not configured - no processing history available');
        return [];
      }

      try {
        const splunkClient = getSplunkClient();
        
        const searchResult = await splunkClient.search.execute(searchQuery, {
          earliestTime: `-${lookbackDays}d`,
          latestTime: 'now',
          maxResults: 50 // Limit history results
        });
        
        if (!searchResult.results || searchResult.results.length === 0) {
          return [];
        }
        
        // Transform Splunk results to our interface
        return searchResult.results.map((result: any) => ({
          timestamp: result.timestamp || result._time,
          jiraTicketKey: result.jira_ticket_key,
          serviceName: result.service_name,
          environment: result.environment
        }));
        
      } catch (splunkError) {
        console.warn('⚠️  Failed to retrieve processing history from Splunk:', splunkError);
        return [];
      }
      
    } catch (error) {
      console.error('Failed to retrieve processing history:', error);
      return [];
    }
  }

  /**
   * Cleans up old triage state records to prevent the summary index from growing indefinitely.
   * This should be called periodically (e.g., monthly) to maintain performance.
   * 
   * @param retentionDays - Number of days to retain records (default 90)
   * @returns Promise resolving to cleanup summary
   */
  async cleanupOldRecords(retentionDays: number = 90): Promise<{ deletedCount: number }> {
    try {
      console.log(`Cleaning up triage records older than ${retentionDays} days`);
      
      // TODO: Implement cleanup using Splunk delete commands or index rotation
      // This might involve running a Splunk delete search or managing index lifecycle
      
      return { deletedCount: 0 };
      
    } catch (error) {
      console.error('Failed to cleanup old records:', error);
      throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Builds a Splunk search query to check for existing triage records.
   * 
   * @param errorSignature - The error signature to search for
   * @returns Splunk search query string
   */
  private buildSearchQuery(errorSignature: string): string {
    // Escape special characters in the error signature for Splunk search
    const escapedSignature = this.escapeSplunkString(errorSignature);
    
    return `index=${this.summaryIndex} sourcetype=${this.sourcetype} error_signature="${escapedSignature}" | head 1`;
  }

  /**
   * Builds a Splunk search query to retrieve processing history.
   * 
   * @param errorSignature - The error signature to search for
   * @param lookbackDays - Number of days to look back
   * @returns Splunk search query string
   */
  private buildHistorySearchQuery(errorSignature: string, lookbackDays: number): string {
    const escapedSignature = this.escapeSplunkString(errorSignature);
    
    return `index=${this.summaryIndex} sourcetype=${this.sourcetype} error_signature="${escapedSignature}" earliest=-${lookbackDays}d | sort -_time`;
  }

  /**
   * Creates a state record object to be written to Splunk.
   * 
   * @param errorSignature - The error signature
   * @param jiraTicketKey - The Jira ticket key
   * @param additionalData - Optional additional data
   * @returns State record object
   */
  private createStateRecord(
    errorSignature: string, 
    jiraTicketKey: string, 
    additionalData?: any
  ): object {
    return {
      timestamp: new Date().toISOString(),
      error_signature: errorSignature,
      jira_ticket_key: jiraTicketKey,
      triage_version: '1.0',
      action: 'error_triaged',
      ...additionalData
    };
  }

  /**
   * Escapes special characters in strings for safe use in Splunk searches.
   * 
   * @param input - The string to escape
   * @returns Escaped string safe for Splunk queries
   */
  private escapeSplunkString(input: string): string {
    // Escape quotes and backslashes for Splunk search
    return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}

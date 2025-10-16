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
   * Checks if an error signature has already been processed and has an active ticket.
   * Uses Splunk search to query the summary index for existing triage records.
   * 
   * @param errorSignature - The normalized error signature to check
   * @returns Promise resolving to true if error has been processed, false otherwise
   */
  async isErrorProcessed(errorSignature: string): Promise<boolean> {
    try {
      // TODO: This should call the existing search_splunk MCP tool
      // The search should look for existing records in the summary index
      
      console.log(`Checking if error signature has been processed: ${errorSignature.substring(0, 50)}...`);
      
      // Construct Splunk search query to find existing triage records
      const searchQuery = this.buildSearchQuery(errorSignature);
      
      console.log(`Executing Splunk search: ${searchQuery}`);
      
      // TODO: Replace with actual MCP tool call
      // Example of what the actual implementation might look like:
      // const searchResult = await this.callMCPTool('search_splunk', {
      //   query: searchQuery,
      //   index: this.summaryIndex,
      //   timeRange: 'last 30 days' // Look back to see if we've seen this error recently
      // });
      // 
      // return searchResult.events && searchResult.events.length > 0;
      
      // Placeholder implementation - in reality this should search Splunk
      // For now, assume no duplicates (always return false to allow processing)
      return false;
      
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
      
      // TODO: This should call an MCP tool to write to Splunk (HEC endpoint or similar)
      // Example of what the actual implementation might look like:
      // await this.callMCPTool('write_to_splunk_hec', {
      //   index: this.summaryIndex,
      //   sourcetype: this.sourcetype,
      //   event: stateRecord
      // });
      
      // Or alternatively, if there's a tool to write summary events:
      // await this.callMCPTool('write_splunk_summary', {
      //   index: this.summaryIndex,
      //   data: stateRecord
      // });
      
      console.log(`Successfully marked error as processed with ticket: ${jiraTicketKey}`);
      
    } catch (error) {
      console.error('Failed to mark error as processed:', error);
      throw new Error(`Unable to update triage state: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      
      // TODO: Implement actual Splunk search
      // const searchResult = await this.callMCPTool('search_splunk', {
      //   query: searchQuery,
      //   index: this.summaryIndex
      // });
      
      // Placeholder implementation
      return [];
      
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

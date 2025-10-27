/**
 * Simple in-memory session state manager for Splunk search pagination
 * Stores the current search job SID and pagination offset
 */

interface SearchJobState {
  sid: string;
  totalResults: number;
  offset: number;
  query: string;
  earliestTime: string;
  latestTime: string;
}

class SplunkSessionManager {
  private currentJob: SearchJobState | null = null;

  /**
   * Sets the current search job
   */
  setJob(sid: string, totalResults: number, query: string, earliestTime: string, latestTime: string): void {
    this.currentJob = {
      sid,
      totalResults,
      offset: 0,
      query,
      earliestTime,
      latestTime
    };
    console.log(`📋 Session: Stored job SID=${sid}, totalResults=${totalResults}`);
  }

  /**
   * Gets the current search job state
   */
  getJob(): SearchJobState | null {
    return this.currentJob;
  }

  /**
   * Sets the current pagination offset
   */
  setOffset(offset: number): void {
    if (this.currentJob) {
      this.currentJob.offset = offset;
      console.log(`📋 Session: Updated offset to ${offset}`);
    }
  }

  /**
   * Gets the current pagination offset
   */
  getOffset(): number {
    return this.currentJob?.offset || 0;
  }

  /**
   * Clears the current session
   */
  clear(): void {
    console.log('📋 Session: Cleared');
    this.currentJob = null;
  }

  /**
   * Checks if there's an active session
   */
  hasActiveJob(): boolean {
    return this.currentJob !== null;
  }
}

// Singleton instance
const sessionManager = new SplunkSessionManager();

export { sessionManager, SearchJobState };


import { getSplunkConfig } from '../../configStore.js';

/**
 * Utility for building Splunk web UI URLs from the existing Splunk configuration.
 */
export class SplunkUrlBuilder {
  /**
   * Builds a Splunk search link for investigating errors in the web UI.
   * Uses the existing Splunk configuration to construct the base URL.
   * 
   * @param errorSignature - The error signature to search for
   * @param firstSeen - When the error was first seen (for time range)
   * @param customBaseUrl - Optional custom base URL (overrides config)
   * @returns URL to Splunk search results
   */
  static async buildSearchLink(
    errorSignature: string, 
    firstSeen: string,
    customBaseUrl?: string
  ): Promise<string> {
    try {
      let baseUrl: string;

      if (customBaseUrl) {
        // Use provided custom URL
        baseUrl = customBaseUrl.replace(/\/+$/, ''); // Remove trailing slashes
      } else {
        // Build URL from existing Splunk config
        try {
          const config = await getSplunkConfig();
          // Convert API config to web UI URL (usually different port)
          // API is typically :8089, Web UI is typically :8000 or :443
          const webPort = config.port === 8089 ? 8000 : config.port;
          baseUrl = `${config.scheme}://${config.host}:${webPort}`;
        } catch {
          // If Splunk config is not available, return a placeholder
          console.warn('⚠️  Splunk not configured - using placeholder URL (set SPLUNK_URL to enable real Splunk links)');
          return 'https://your-splunk.com/en-US/app/search/search';
        }
      }

      // Create a search that will find similar errors
      const searchTerms = errorSignature.split(' ')
        .filter(term => term.length > 2) // Filter out short words
        .slice(0, 3) // Take first 3 meaningful terms
        .join(' AND ');
      
      const encodedSearch = encodeURIComponent(`search ${searchTerms}`);
      
      // Set time range to start from first seen error
      const firstSeenDate = new Date(firstSeen);
      const earliestTime = Math.floor(firstSeenDate.getTime() / 1000); // Unix timestamp
      
      return `${baseUrl}/en-US/app/search/search?q=${encodedSearch}&earliest=${earliestTime}&latest=now`;
      
    } catch (error) {
      console.warn('Failed to build Splunk search link:', error);
      return customBaseUrl 
        ? `${customBaseUrl}/en-US/app/search/search`
        : 'https://your-splunk.com/en-US/app/search/search';
    }
  }

  /**
   * Builds a link to a specific Splunk dashboard.
   * 
   * @param dashboardName - Name of the dashboard
   * @param customBaseUrl - Optional custom base URL
   * @returns URL to the Splunk dashboard
   */
  static async buildDashboardLink(dashboardName: string, customBaseUrl?: string): Promise<string> {
    try {
      let baseUrl: string;

      if (customBaseUrl) {
        baseUrl = customBaseUrl.replace(/\/+$/, '');
      } else {
        try {
          const config = await getSplunkConfig();
          const webPort = config.port === 8089 ? 8000 : config.port;
          baseUrl = `${config.scheme}://${config.host}:${webPort}`;
        } catch {
          return 'https://your-splunk.com/en-US/app/search/dashboard';
        }
      }

      return `${baseUrl}/en-US/app/search/dashboard/${encodeURIComponent(dashboardName)}`;
    } catch (error) {
      console.warn('Failed to build Splunk dashboard link:', error);
      return customBaseUrl 
        ? `${customBaseUrl}/en-US/app/search/dashboard`
        : 'https://your-splunk.com/en-US/app/search/dashboard';
    }
  }

  /**
   * Gets the Splunk web UI base URL from configuration.
   * 
   * @returns Base URL for Splunk web interface
   */
  static async getBaseUrl(): Promise<string | null> {
    try {
      const config = await getSplunkConfig();
      const webPort = config.port === 8089 ? 8000 : config.port;
      return `${config.scheme}://${config.host}:${webPort}`;
    } catch {
      return null;
    }
  }
}

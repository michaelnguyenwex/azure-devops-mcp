import { SplunkClient } from '../client.js';
import { SearchOptions, SearchResults, CreateJobResponse, SplunkError } from '../types.js';

export class SearchEndpoint {
  constructor(private client: SplunkClient) {}

  async execute(query: string, options: SearchOptions): Promise<SearchResults> {
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

    let normalizedQuery = query.trim();
    if (!normalizedQuery.startsWith('|') && 
        !normalizedQuery.toLowerCase().startsWith('search')) {
      normalizedQuery = `search ${normalizedQuery}`;
    }

    try {
      const jobResponse = await this.client.request<CreateJobResponse>(
        'POST',
        '/services/search/jobs',
        new URLSearchParams({
          search: normalizedQuery,
          earliest_time: options.earliestTime,
          latest_time: options.latestTime,
          exec_mode: 'blocking',
          output_mode: 'json'
        })
      );

      const results = await this.client.request<SearchResults>(
        'GET',
        `/services/search/jobs/${jobResponse.sid}/results`,
        undefined,
        { output_mode: 'json', count: options.maxResults.toString() }
      );

      return results;
    } catch (error) {
      if (error instanceof SplunkError) {
        throw new Error(`Splunk search failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Creates a search job and returns the SID (Search ID)
   */
  async createJob(query: string, earliestTime: string, latestTime: string): Promise<CreateJobResponse> {
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

    let normalizedQuery = query.trim();
    if (!normalizedQuery.startsWith('|') && 
        !normalizedQuery.toLowerCase().startsWith('search')) {
      normalizedQuery = `search ${normalizedQuery}`;
    }

    try {
      const jobResponse = await this.client.request<CreateJobResponse>(
        'POST',
        '/services/search/jobs',
        new URLSearchParams({
          search: normalizedQuery,
          earliest_time: earliestTime,
          latest_time: latestTime,
          exec_mode: 'blocking',
          output_mode: 'json'
        })
      );

      return jobResponse;
    } catch (error) {
      if (error instanceof SplunkError) {
        throw new Error(`Splunk job creation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Gets results for a specific search job with pagination support
   */
  async getJobResults(sid: string, count: number = 25, offset: number = 0): Promise<SearchResults> {
    try {
      const results = await this.client.request<SearchResults>(
        'GET',
        `/services/search/jobs/${sid}/results`,
        undefined,
        { 
          output_mode: 'json', 
          count: count.toString(),
          offset: offset.toString()
        }
      );

      return results;
    } catch (error) {
      if (error instanceof SplunkError) {
        throw new Error(`Splunk job results retrieval failed: ${error.message}`);
      }
      throw error;
    }
  }
}


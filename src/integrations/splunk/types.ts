// Re-export SplunkConfig from configStore for convenience
export type { SplunkConfig } from '../../configStore.js';

export interface SearchOptions {
  earliestTime: string;
  latestTime: string;
  maxResults: number;
}

export interface SearchResult {
  [key: string]: any;
  _time?: string;
  _raw?: string;
}

export interface SearchResults {
  results: SearchResult[];
}

export interface CreateJobResponse {
  sid: string;
}

export interface SavedSearch {
  name: string;
  description: string;
  search: string;
}

export interface SavedSearchesResponse {
  entry: Array<{
    name: string;
    content: {
      description?: string;
      search: string;
    };
  }>;
}

export class SplunkError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'SplunkError';
  }
}


import { SplunkClient } from '../client.js';
import { SavedSearch, SavedSearchesResponse } from '../types.js';

export class SavedSearchesEndpoint {
  constructor(private client: SplunkClient) {}

  async list(): Promise<SavedSearch[]> {
    const response = await this.client.request<SavedSearchesResponse>(
      'GET',
      '/services/saved/searches',
      undefined,
      { output_mode: 'json', count: '0' }
    );

    return response.entry.map(entry => ({
      name: entry.name,
      description: entry.content.description || '',
      search: entry.content.search
    }));
  }
}


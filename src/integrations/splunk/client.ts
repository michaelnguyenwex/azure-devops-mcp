import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { SplunkConfig, SplunkError } from './types.js';
import { SearchEndpoint } from './endpoints/search.js';

export class SplunkClient {
  private axios: AxiosInstance;
  public search: SearchEndpoint;

  constructor(config: SplunkConfig) {
    const httpsAgent = config.verifySsl 
      ? undefined 
      : new https.Agent({ rejectUnauthorized: false });

    this.axios = axios.create({
      baseURL: `${config.scheme}://${config.host}:${config.port}`,
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      httpsAgent,
      timeout: 60000
    });

    this.axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          throw new SplunkError(
            error.response.data?.messages?.[0]?.text || error.message,
            error.response.status,
            error.response.data
          );
        }
        throw error;
      }
    );

    this.search = new SearchEndpoint(this);
  }

  async request<T>(
    method: string,
    path: string,
    data?: any,
    params?: Record<string, string>
  ): Promise<T> {
    const response = await this.axios.request<T>({
      method,
      url: path,
      data,
      params: { output_mode: 'json', ...params }
    });
    return response.data;
  }
}

// Singleton
let clientInstance: SplunkClient | null = null;

export function initializeSplunkClient(config: SplunkConfig): SplunkClient {
  clientInstance = new SplunkClient(config);
  return clientInstance;
}

export function getSplunkClient(): SplunkClient {
  if (!clientInstance) {
    throw new Error('Splunk client not initialized');
  }
  return clientInstance;
}


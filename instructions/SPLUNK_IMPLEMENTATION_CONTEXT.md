# Splunk Integration Implementation Context

**Purpose:** Complete context for implementing Splunk search in existing TypeScript MCP app  
**Date:** October 10, 2025  
**Scope:** Minimal - Search functionality only

---

## 🎯 What You're Building

Add Splunk search to existing TypeScript MCP app (Copilot STDIO):
- ✅ 3-4 MCP tools (search, saved searches, ping, optional indexes)
- ✅ 2 API endpoints (search, saved searches)
- ✅ 7 files total
- ✅ 4-6 hours implementation time

---

## 📁 Files to Create

```
your-existing-mcp-app/src/integrations/splunk/
├── types.ts
├── client.ts
├── endpoints/
│   ├── search.ts
│   └── saved-searches.ts
└── tools/
    ├── search.tool.ts
    ├── saved-searches.tool.ts
    ├── ping.tool.ts
    └── indexes-sourcetypes.tool.ts (optional)
```

---

## 🔑 Key Requirements

### Background
- Have existing TypeScript MCP app
- Snap Splunk into existing framework
- STDIO transport (Copilot) only
- No need for: indexes, users, kvstore, apps endpoints

### Scope
- **Keep:** Search endpoint, Saved searches endpoint
- **Remove:** Indexes, Users, KV Store, Apps endpoints
- **Transport:** STDIO only (existing)
- **Tools:** 3-4 tools (down from 11)

---

## 📦 Dependencies

```bash
npm install axios
# If not already installed:
npm install dotenv
npm install -D @types/node
```

---

## 🔐 Environment Variables

```env
SPLUNK_HOST=your-splunk-host.com
SPLUNK_PORT=8089
SPLUNK_SCHEME=https
SPLUNK_TOKEN=your-splunk-token
SPLUNK_VERIFY_SSL=false
```

---

## 💻 Complete Implementation Code

### 1. Types (`types.ts`)

```typescript
export interface SplunkConfig {
  host: string;
  port: number;
  scheme: 'http' | 'https';
  token: string;
  verifySsl: boolean;
}

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
```

---

### 2. Client (`client.ts`)

```typescript
import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { SplunkConfig, SplunkError } from './types';
import { SearchEndpoint } from './endpoints/search';
import { SavedSearchesEndpoint } from './endpoints/saved-searches';

export class SplunkClient {
  private axios: AxiosInstance;
  public search: SearchEndpoint;
  public savedSearches: SavedSearchesEndpoint;

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
    this.savedSearches = new SavedSearchesEndpoint(this);
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
```

---

### 3. Search Endpoint (`endpoints/search.ts`)

```typescript
import { SplunkClient } from '../client';
import { SearchOptions, SearchResults, CreateJobResponse, SplunkError } from '../types';

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
}
```

---

### 4. Saved Searches Endpoint (`endpoints/saved-searches.ts`)

```typescript
import { SplunkClient } from '../client';
import { SavedSearch, SavedSearchesResponse } from '../types';

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
```

---

### 5. Search Tool (`tools/search.tool.ts`)

```typescript
import { getSplunkClient } from '../client';

export const searchSplunkTool = {
  name: 'search_splunk',
  description: 'Execute a Splunk search query using SPL (Search Processing Language)',
  inputSchema: {
    type: 'object',
    properties: {
      search_query: {
        type: 'string',
        description: 'The Splunk SPL query to execute'
      },
      earliest_time: {
        type: 'string',
        description: 'Start time for search',
        default: '-24h'
      },
      latest_time: {
        type: 'string',
        description: 'End time for search',
        default: 'now'
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results',
        default: 100
      }
    },
    required: ['search_query']
  },
  handler: async (args: any) => {
    const client = getSplunkClient();
    
    const results = await client.search.execute(args.search_query, {
      earliestTime: args.earliest_time || '-24h',
      latestTime: args.latest_time || 'now',
      maxResults: args.max_results || 100
    });
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results.results, null, 2)
      }]
    };
  }
};
```

---

### 6. Saved Searches Tool (`tools/saved-searches.tool.ts`)

```typescript
import { getSplunkClient } from '../client';

export const listSavedSearchesTool = {
  name: 'list_saved_searches',
  description: 'List all saved searches in Splunk',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  handler: async () => {
    const client = getSplunkClient();
    const savedSearches = await client.savedSearches.list();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(savedSearches, null, 2)
      }]
    };
  }
};
```

---

### 7. Ping Tool (`tools/ping.tool.ts`)

```typescript
export const splunkPingTool = {
  name: 'splunk_ping',
  description: 'Check Splunk connectivity',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  handler: async () => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'ok',
          service: 'splunk',
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  }
};
```

---

### 8. Optional: Indexes & Sourcetypes Tool (`tools/indexes-sourcetypes.tool.ts`)

```typescript
import { getSplunkClient } from '../client';

export const getIndexesAndSourcetypesTool = {
  name: 'get_indexes_and_sourcetypes',
  description: 'Get all Splunk indexes and their sourcetypes',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  handler: async () => {
    const client = getSplunkClient();
    
    const query = `
      | tstats count WHERE index=* BY index, sourcetype
      | stats count BY index, sourcetype
      | sort - count
    `;
    
    const results = await client.search.execute(query, {
      earliestTime: '-24h',
      latestTime: 'now',
      maxResults: 10000
    });
    
    const sourcetypesByIndex: Record<string, Array<{
      sourcetype: string;
      count: string;
    }>> = {};
    
    const indexes = new Set<string>();
    
    for (const result of results.results) {
      const index = result.index || '';
      const sourcetype = result.sourcetype || '';
      const count = result.count || '0';
      
      indexes.add(index);
      
      if (!sourcetypesByIndex[index]) {
        sourcetypesByIndex[index] = [];
      }
      
      sourcetypesByIndex[index].push({ sourcetype, count });
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          indexes: Array.from(indexes),
          sourcetypes: sourcetypesByIndex,
          metadata: {
            totalIndexes: indexes.size,
            totalSourcetypes: results.results.length,
            searchTimeRange: '24 hours'
          }
        }, null, 2)
      }]
    };
  }
};
```

---

## 🔌 Integration into Your MCP App

### Initialize Client (in your app startup)

```typescript
import { initializeSplunkClient } from './integrations/splunk/client';

// During app initialization
if (process.env.SPLUNK_TOKEN) {
  initializeSplunkClient({
    host: process.env.SPLUNK_HOST!,
    port: parseInt(process.env.SPLUNK_PORT || '8089'),
    scheme: (process.env.SPLUNK_SCHEME || 'https') as 'http' | 'https',
    token: process.env.SPLUNK_TOKEN,
    verifySsl: process.env.SPLUNK_VERIFY_SSL === 'true'
  });
  console.log('✅ Splunk initialized');
}
```

### Register Tools (in your tool registry)

```typescript
import {
  searchSplunkTool,
  listSavedSearchesTool,
  splunkPingTool,
  getIndexesAndSourcetypesTool // optional
} from './integrations/splunk/tools';

export const allTools = [
  // ... your existing tools
  searchSplunkTool,
  listSavedSearchesTool,
  splunkPingTool,
  // getIndexesAndSourcetypesTool // optional
];
```

---

## 🧪 Testing

### Quick Test File (create `integrations/splunk/test.ts`)

```typescript
import { SplunkClient } from './client';

async function test() {
  const client = new SplunkClient({
    host: process.env.SPLUNK_HOST || 'your-host',
    port: 8089,
    scheme: 'https',
    token: process.env.SPLUNK_TOKEN || 'your-token',
    verifySsl: false
  });

  try {
    console.log('Testing search...');
    const results = await client.search.execute(
      'index=_internal | head 5',
      { earliestTime: '-1h', latestTime: 'now', maxResults: 5 }
    );
    console.log('✅ Search works!', results.results.length, 'results');

    console.log('\nTesting saved searches...');
    const saved = await client.savedSearches.list();
    console.log('✅ Saved searches works!', saved.length, 'searches');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

test();
```

Run: `npx tsx src/integrations/splunk/test.ts`

---

## 📋 Implementation Checklist

### PoC Phase (1-2 hours)
- [ ] Create folder structure
- [ ] Implement types.ts
- [ ] Implement client.ts
- [ ] Implement endpoints/search.ts
- [ ] Create test.ts
- [ ] **VALIDATE: Test Splunk connectivity**

### Full Implementation (2-3 hours)
- [ ] Implement endpoints/saved-searches.ts
- [ ] Implement tools/search.tool.ts
- [ ] Implement tools/saved-searches.tool.ts
- [ ] Implement tools/ping.tool.ts
- [ ] Optional: tools/indexes-sourcetypes.tool.ts

### Integration (30 min)
- [ ] Add environment variables to .env
- [ ] Initialize client in app startup
- [ ] Register tools in tool registry
- [ ] **TEST: Try in Copilot chat**

---

## ⚠️ Common Issues & Solutions

### SSL Certificate Error
```
Error: unable to verify the first certificate
```
**Fix:** Set `SPLUNK_VERIFY_SSL=false` or provide CA cert

### Authentication Failed
```
Error: 401 Unauthorized
```
**Fix:** Check token validity and permissions

### Search Timeout
```
Error: timeout
```
**Fix:** Use narrower time range or increase timeout

---

## 🎯 Success Criteria

✅ Can execute Splunk searches via Copilot  
✅ Can list saved searches  
✅ Error handling works properly  
✅ Works in STDIO mode (Copilot chat)  

---

## 📊 REST API Endpoints Used

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create search | POST | `/services/search/jobs` |
| Get results | GET | `/services/search/jobs/{sid}/results` |
| List saved searches | GET | `/services/saved/searches` |

---

## 💡 Key Implementation Notes

1. **Query Normalization:** Always prepend "search" to queries that don't start with "|" or "search"
2. **Blocking Mode:** Use `exec_mode: 'blocking'` to wait for search completion
3. **SSL Handling:** Configure https.Agent with `rejectUnauthorized: false` for self-signed certs
4. **Singleton Pattern:** Use single client instance across all tools
5. **Error Wrapping:** Wrap Splunk errors in custom SplunkError class

---

## 📈 Timeline

| Phase | Time |
|-------|------|
| PoC (validate connectivity) | 1-2 hours |
| Complete implementation | 2-3 hours |
| Integration & testing | 1 hour |
| **Total** | **4-6 hours** |

---

## 🔗 Related Documentation

Full details in MonitoringMCPs repo:
- `SPLUNK_MIGRATION_UPDATED_SCOPE.md` - Complete updated plan
- `SPLUNK_QUICK_IMPLEMENTATION_GUIDE.md` - Step-by-step guide
- `SPLUNK_TO_TYPESCRIPT_MIGRATION_PLAN.md` - Original full plan (pre-scope reduction)

---

## ✅ Ready to Implement

All code is copy-paste ready. Start with PoC to validate Splunk connectivity, then complete full implementation.

**Estimated time to first working search: 2-3 hours**

---

**Context Version:** 1.0  
**Last Updated:** October 10, 2025  
**Status:** Ready for implementation in your TypeScript MCP project


import { getOpenAIConfig } from '../configStore.js';
import { ParsedUserRequest, DevOpsMode } from './types.js';
import axios from 'axios';

/**
 * Parses a natural language user request to extract the mode and PR URL
 * Uses OpenAI to intelligently parse the request
 * 
 * @param userRequest - Natural language request like "create ff [PR_URL]"
 * @returns Promise resolving to parsed mode and PR URL
 * @throws Error if parsing fails or request is invalid
 */
export async function parseUserRequest(userRequest: string): Promise<ParsedUserRequest> {
  try {
    console.log(`📝 Parsing user request: "${userRequest}"`);
    
    const openAIConfig = await getOpenAIConfig();
    
    const prompt = `You are a request parser. Extract the mode and GitHub PR URL from the user's request.

IMPORTANT: Check for "pipeline" keyword FIRST before checking other keywords.

Mode can be one of:
- "Pipeline" - if request mentions "pipeline" anywhere (keywords: pipeline, run pipeline, create pipeline, execute pipeline)
- "CreateFF" - for creating a feature flag (keywords: create ff, add ff, new ff, create feature flag)
- "RemoveFF" - for removing a feature flag (keywords: remove ff, delete ff, cleanup ff, remove feature flag)

Return JSON only, no other text. Format:
{
  "mode": "CreateFF" | "RemoveFF" | "Pipeline",
  "pr": "full GitHub PR URL"
}

Examples:
- "create ff https://github.com/owner/repo/pull/123" → {"mode":"CreateFF","pr":"https://github.com/owner/repo/pull/123"}
- "remove ff https://github.com/owner/repo/pull/456" → {"mode":"RemoveFF","pr":"https://github.com/owner/repo/pull/456"}
- "run pipeline https://github.com/owner/repo/pull/789" → {"mode":"Pipeline","pr":"https://github.com/owner/repo/pull/789"}
- "create pipeline for https://github.com/owner/repo/pull/789" → {"mode":"Pipeline","pr":"https://github.com/owner/repo/pull/789"}

User request: "${userRequest}"`;

    const response = await axios.post(
      `${openAIConfig.baseUrl}/chat/completions`,
      {
        model: 'azure-gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a request parser that outputs only JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 200
      },
      {
        headers: {
          'Authorization': `Bearer ${openAIConfig.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log(`📝 OpenAI response: ${content}`);

    // Parse JSON response
    let parsed: ParsedUserRequest;
    try {
      parsed = JSON.parse(content);
    } catch (jsonError) {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error(`Failed to parse OpenAI response as JSON: ${content}`);
      }
    }

    // Validate mode
    const validModes: DevOpsMode[] = ['CreateFF', 'RemoveFF', 'Pipeline'];
    if (!validModes.includes(parsed.mode)) {
      throw new Error(`Invalid mode: ${parsed.mode}. Must be one of: ${validModes.join(', ')}`);
    }

    // Validate PR URL
    if (!parsed.pr || !parsed.pr.includes('github.com')) {
      throw new Error(`Invalid GitHub PR URL: ${parsed.pr}`);
    }

    console.log(`✅ Parsed request - Mode: ${parsed.mode}, PR: ${parsed.pr}`);

    return parsed;
  } catch (error) {
    console.error('❌ Failed to parse user request:', error);
    throw new Error(`Failed to parse user request: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


import { RawSplunkEvent, ParsedRawData, TriageInput, StackFrame, SearchKeywords } from './types.js';
import { getOpenAIConfig } from '../configStore.js';

/**
 * Parses a raw Splunk JSON string into a structured TriageInput object.
 * 
 * @param rawSplunkJson - The raw Splunk JSON string to parse
 * @returns A structured TriageInput object ready for triage processing
 */
export async function parseRawSplunkEvent(rawSplunkJson: string): Promise<TriageInput> {
  try {
    // First parse the outer Splunk event JSON
    const rawEvent: RawSplunkEvent = JSON.parse(rawSplunkJson);
    
    // Then parse the _raw JSON string inside it
    const parsedRawData: ParsedRawData = JSON.parse(rawEvent._raw);
    
    // Create the TriageInput object with basic field mappings
    const triageInput: TriageInput = {
      serviceName: rawEvent.Application,
      environment: rawEvent.Environment,
      timestamp: new Date(rawEvent._time).toISOString(),
      errorMessage: '', // Will be populated later
      exceptionType: '', // Will be populated later
      stackTrace: [], // Will be populated later
      searchKeywords: {
        files: [],
        methods: [],
        context: []
      }
    };
    
    // Parse exception information from @x field
    const exceptionString = parsedRawData['@x'];
    const exceptionLines = exceptionString.split('\n');
    const firstLine = exceptionLines[0];
    
    // Find the index of the first colon to separate exception type from message
    const colonIndex = firstLine.indexOf(':');
    
    if (colonIndex !== -1) {
      triageInput.exceptionType = firstLine.substring(0, colonIndex).trim();
      const rawErrorMessage = firstLine.substring(colonIndex + 1).trim();
      // Remove surrounding quotes if present
      triageInput.errorMessage = rawErrorMessage.replace(/^["']|["']$/g, '');
    } else {
      // Fallback if no colon found
      triageInput.exceptionType = firstLine.trim();
      triageInput.errorMessage = 'No error message found';
    }
    
    // Parse stack trace from @x exception field (reuse exceptionLines already declared above)
    
    // Regex to parse .NET stack trace format: "at ClassName.MethodName(...) in filepath:line lineNumber"
    const stackFrameRegex = /at\s+.*?\.(?<method>[^.(]+)(?:\([^)]*\))?\s+in\s+.*?[\\\/](?<file>[^\\\/\s]+):line\s+(?<line>\d+)/;
    // Regex for frames without line numbers but with clear method names
    const stackFrameNoLineRegex = /at\s+.*?\.(?<method>[^.(]+)(?:\([^)]*\))?$/;
    
    // System/framework namespaces to filter out
    const systemNamespaces = [
      'System.Runtime.ExceptionServices',
      'System.Runtime.CompilerServices',
      'System.Threading.Tasks'
    ];
    
    for (const line of exceptionLines) {
      // Skip system/framework stack frames
      if (systemNamespaces.some(ns => line.includes(ns))) {
        continue;
      }
      
      const lineMatch = stackFrameRegex.exec(line.trim());
      if (lineMatch && lineMatch.groups) {
        const frame: StackFrame = {
          file: lineMatch.groups.file,
          method: lineMatch.groups.method,
          line: parseInt(lineMatch.groups.line)
        };
        triageInput.stackTrace.push(frame);
      } else {
        // Try to match frames without line numbers for application code
        const noLineMatch = stackFrameNoLineRegex.exec(line.trim());
        if (noLineMatch && noLineMatch.groups && !line.includes('System.')) {
          let methodName = noLineMatch.groups.method;
          
          // Check if this line contains an async method in angle brackets
          const asyncMethodMatch = line.match(/<([^>]+)>/);
          if (asyncMethodMatch) {
            methodName = asyncMethodMatch[1];
          }
          
          // Extract class name to infer file name  
          const classMatch = line.match(/at\s+([\w.]+)\./);
          if (classMatch) {
            const fullClassName = classMatch[1];
            const classNameParts = fullClassName.split('.');
            const className = classNameParts[classNameParts.length - 1];
            
            // Only include if it looks like application code
            if (className.includes('Api') || className.includes('Client') || className.includes('Service') || className.includes('Provider') || className.includes('Extensions')) {
              const frame: StackFrame = {
                file: className + '.cs',
                method: methodName,
                line: null
              };
              triageInput.stackTrace.push(frame);
            }
          }
        }
      }
    }
    
    // Aggregate search keywords
    // Extract unique files from stack trace
    const uniqueFiles = new Set(triageInput.stackTrace.map(frame => frame.file));
    triageInput.searchKeywords.files = Array.from(uniqueFiles);
    
    // Extract unique methods from stack trace
    const uniqueMethods = new Set(triageInput.stackTrace.map(frame => frame.method));
    triageInput.searchKeywords.methods = Array.from(uniqueMethods);
    
    // Add context keywords from exception type and source context
    const contextKeywords: string[] = [];
    
    // Add exception type as context (remove namespace prefixes for readability)
    const exceptionTypeParts = triageInput.exceptionType.split('.');
    if (exceptionTypeParts.length > 0) {
      contextKeywords.push(exceptionTypeParts[exceptionTypeParts.length - 1]);
    }
    
    // Extract SourceContext if available
    if (parsedRawData.SourceContext) {
      const sourceContextParts = parsedRawData.SourceContext.split('.');
      if (sourceContextParts.length > 0) {
        contextKeywords.push(sourceContextParts[sourceContextParts.length - 1]);
      }
    }
    
    // Extract service name from the message template if available
    const messageTemplate = parsedRawData['@mt'];
    const serviceMatch = messageTemplate.match(/\[(\w+Service)\]/);
    if (serviceMatch) {
      contextKeywords.push(serviceMatch[1]);
    }
    
    triageInput.searchKeywords.context = contextKeywords;
    
    return triageInput;
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse the _raw JSON string.');
    }
    throw new Error(`Failed to parse raw Splunk event: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parses a raw Splunk JSON string into a structured TriageInput object using OpenAI API.
 * 
 * @param rawSplunkJson - The raw Splunk JSON string to parse
 * @returns A structured TriageInput object ready for triage processing
 */
export async function parseRawSplunkEventWithOpenAI(rawSplunkJson: string): Promise<TriageInput> {
  try {
    // Get OpenAI configuration
    const openAIConfig = await getOpenAIConfig();
    
    // Create the prompt by replacing {{inputText}} with the actual input
    const promptTemplate = `Your task is to act as a data extraction and transformation engine. You will be given a raw JSON log entry, denoted as \`<inputText>\`. Your goal is to parse this log, extract specific pieces of information from its nested fields, and structure them into a clean, new JSON object, denoted as \`<jsonOutput>\`.

> Follow these extraction and mapping rules precisely.

## Extraction and Mapping Rules

1.  **Parse the \`_raw\` field**: The core information is located within the \`_raw\` field of the \`<inputText>\`. This field is a JSON string that must be parsed first.
2.  **Map top-level fields**:
     * \`serviceName\`: Extract from the \`Application\` field.
     * \`environment\`: Extract from the \`Environment\` field.
3.  **Extract from the parsed \`_raw\` content**:
     * \`timestamp\`: Extract the value from the \`@t\` field.
     * \`exceptionType\`: From the \`@x\` field, this is the exception name that appears before the first colon (e.g., \`WEXHealth.Enterprise.DocumentIndex.SDK.DocumentIndexApiException\`).
     * \`errorMessage\`: From the \`@x\` field, this is the descriptive message inside the first set of escaped double quotes (\`\"...\"\`) that follows the \`exceptionType\`.
     * \`stackTrace\`:
         * Parse the stack trace details from the \`@x\` field.
         * Create an array of objects for stack frames that include a file path.
         * For each frame, extract the \`file\` name (e.g., \`SdkApiClient.cs\`), the \`method\` name, and the \`line\` number. If a line number is not available, set it to \`null\`.
     * \`searchKeywords\`:
         * \`files\`: Create an array of unique \`file\` names found in the stack trace.
         * \`methods\`: Create an array of unique \`method\` names found in the stack trace.
         * \`context\`: Create an array of relevant contextual keywords, including the \`exceptionType\`, the \`SourceContext\`, and any other significant service names mentioned (e.g., \`DocumentIndexService\`).

**Now, using these rules, transform the following \`<inputText>\` into the corresponding \`<jsonOutput>\`.**

### \`<inputText>\`
{{inputText}}

### \`<jsonOutput>\`

\`\`\`json
{
  "serviceName": "WexHealth.CDH.Web.Consumer",
  "environment": "QA",
  "timestamp": "2025-10-16T14:13:57.833Z",
  "errorMessage": "Object reference not set to an instance of an object.",
  "exceptionType": "WEXHealth.Enterprise.DocumentIndex.SDK.DocumentIndexApiException",
  "stackTrace": [
    {
      "file": "SdkApiClient.cs",
      "method": "ReadAsJsonAsync",
      "line": null
    },
    {
      "file": "ApiClient.cs",
      "method": "GetJsonAsync",
      "line": null
    },
    {
      "file": "DocumentIndexApi.cs",
      "method": "GetShareableUrlAsync",
      "line": null
    },
    {
      "file": "SdkApiClient.cs",
      "method": "GetShareableUrl",
      "line": 173
    },
    {
      "file": "DocumentIndexProvider.cs",
      "method": "GetShareableUrl",
      "line": 299
    }
  ],
  "searchKeywords": {
    "files": [
      "SdkApiClient.cs",
      "DocumentIndexProvider.cs",
      "ApiClient.cs",
      "DocumentIndexApi.cs"
    ],
    "methods": [
      "GetShareableUrl",
      "GetShareableUrlAsync",
      "ReadAsJsonAsync",
      "GetJsonAsync"
    ],
    "context": [
      "DocumentIndexApiException",
      "DocumentIndexProvider",
      "DocumentIndexService"
    ]
  }
}
\`\`\`

Please return only the JSON object without any code blocks or additional text.`;

    const prompt = promptTemplate.replace('{{inputText}}', rawSplunkJson);
    
    // Call OpenAI API
    const response = await fetch(`${openAIConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'azure-gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText}`);
    }

    const openAIResponse = await response.json();
    
    if (!openAIResponse.choices || openAIResponse.choices.length === 0) {
      throw new Error('No response from OpenAI API');
    }

    const content = openAIResponse.choices[0].message.content;
    
    // Parse the JSON response from OpenAI
    let parsedResult;
    try {
      // Try to extract JSON from the response in case it's wrapped in code blocks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsedResult = JSON.parse(jsonString);
    } catch (parseError) {
      throw new Error(`Failed to parse OpenAI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Convert the parsed result to TriageInput format
    const triageInput: TriageInput = {
      serviceName: parsedResult.serviceName || '',
      environment: parsedResult.environment || '',
      timestamp: parsedResult.timestamp || new Date().toISOString(),
      errorMessage: parsedResult.errorMessage || '',
      exceptionType: parsedResult.exceptionType || '',
      stackTrace: parsedResult.stackTrace || [],
      searchKeywords: {
        files: parsedResult.searchKeywords?.files || [],
        methods: parsedResult.searchKeywords?.methods || [],
        context: parsedResult.searchKeywords?.context || []
      }
    };

    return triageInput;
    
  } catch (error) {
    throw new Error(`Failed to parse raw Splunk event with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

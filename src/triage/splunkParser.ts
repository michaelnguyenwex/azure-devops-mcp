import { RawSplunkEvent, ParsedRawData, TriageInput, StackFrame, SearchKeywords } from './types.js';

/**
 * Parses a raw Splunk event into a structured TriageInput object.
 * 
 * @param rawEvent - The raw Splunk event to parse
 * @returns A structured TriageInput object ready for triage processing
 */
export async function parseRawSplunkEvent(rawEvent: RawSplunkEvent): Promise<TriageInput> {
  try {
    // Parse the _raw JSON string
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
    
    // Parse stack trace from @mt field
    const messageTemplate = parsedRawData['@mt'];
    const stackTraceMarker = '[StackTrace]:';
    const stackTraceIndex = messageTemplate.indexOf(stackTraceMarker);
    
    if (stackTraceIndex !== -1) {
      // Extract the stack trace portion after the [StackTrace]: marker
      const stackTraceString = messageTemplate.substring(stackTraceIndex + stackTraceMarker.length).trim();
      
      // Split by '=>' delimiter to get individual stack frames
      const frameStrings = stackTraceString.split('=>');
      
      // Regex to parse frame format: [Assembly]:assembly;[File]:file.cs;[Method]:method(lineNumber)
      const frameRegex = /\[File\]:(?<file>.*?);?\[Method\]:(?<method>.*?)(\((?<line>\d+)\))?/;
      
      for (const frameString of frameStrings) {
        const match = frameRegex.exec(frameString.trim());
        if (match && match.groups) {
          const frame: StackFrame = {
            file: match.groups.file,
            method: match.groups.method,
            line: match.groups.line ? parseInt(match.groups.line) : null
          };
          triageInput.stackTrace.push(frame);
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

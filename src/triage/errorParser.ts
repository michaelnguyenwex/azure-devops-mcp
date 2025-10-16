import { SplunkLogEvent } from './types.js';

/**
 * Generates a normalized error signature by stripping unique, instance-specific data
 * from an error message to create a stable, generic signature for grouping similar errors.
 * 
 * @param errorMessage - The raw error message from the log
 * @returns A normalized error signature for grouping
 */
export function generateErrorSignature(errorMessage: string): string {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return 'UNKNOWN_ERROR';
  }

  let signature = errorMessage;

  // Remove UUIDs (8-4-4-4-12 format)
  signature = signature.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, 'UUID');

  // Remove GUIDs (alternative formats)
  signature = signature.replace(/\b[0-9a-f]{32}\b/gi, 'GUID');

  // Remove timestamps (various formats)
  signature = signature.replace(/\b\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d{3})?[Z]?([+-]\d{2}:?\d{2})?\b/g, 'TIMESTAMP');
  signature = signature.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\s\d{1,2}:\d{2}:\d{2}\s?(AM|PM)?\b/gi, 'TIMESTAMP');
  signature = signature.replace(/\b\d{10,13}\b/g, 'TIMESTAMP'); // Unix timestamps

  // Remove transaction IDs and session IDs
  signature = signature.replace(/\b(transaction|session|request)[_-]?id[:\s=]+[\w-]+\b/gi, 'TRANSACTION_ID');
  signature = signature.replace(/\b(txn|req|sess)[_-]?id[:\s=]+[\w-]+\b/gi, 'TRANSACTION_ID');

  // Remove correlation IDs
  signature = signature.replace(/\b(correlation|trace)[_-]?id[:\s=]+[\w-]+\b/gi, 'CORRELATION_ID');

  // Remove IP addresses
  signature = signature.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, 'IP_ADDRESS');
  signature = signature.replace(/\b([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi, 'IPV6_ADDRESS');

  // Remove memory addresses and pointers
  signature = signature.replace(/\b0x[0-9a-f]+\b/gi, 'MEMORY_ADDRESS');

  // Remove file paths that contain dynamic elements
  signature = signature.replace(/\b[a-z]:[\\\/][^\\\/\s]+[\\\/]temp[\\\/][^\\\/\s]+/gi, 'TEMP_PATH');
  signature = signature.replace(/\b\/tmp\/[^\s]+/g, 'TEMP_PATH');

  // Remove numeric IDs that might be dynamic
  signature = signature.replace(/\bid[:\s=]+\d+\b/gi, 'NUMERIC_ID');
  signature = signature.replace(/\b(user|customer|order|account)[_-]?id[:\s=]+\d+\b/gi, 'ENTITY_ID');

  // Remove port numbers
  signature = signature.replace(/:\d{4,5}\b/g, ':PORT');

  // Remove specific numeric values that might vary
  signature = signature.replace(/\b\d{6,}\b/g, 'LARGE_NUMBER'); // Large numbers that might be IDs

  // Normalize common variable patterns
  signature = signature.replace(/\$\{[^}]+\}/g, 'VARIABLE');
  signature = signature.replace(/%[^%\s]+%/g, 'VARIABLE');

  // Remove stack trace line numbers
  signature = signature.replace(/:\d+\)/g, ':LINE)');
  signature = signature.replace(/line\s+\d+/gi, 'line NUMBER');

  // Normalize whitespace
  signature = signature.replace(/\s+/g, ' ').trim();

  // Convert to uppercase for consistency (optional, helps with case variations)
  signature = signature.toUpperCase();

  return signature;
}

/**
 * Groups error log events by their generated error signature.
 * 
 * @param logs - Array of Splunk log events to group
 * @returns Map where keys are error signatures and values are arrays of matching log events
 */
export function aggregateErrorsBySignature(logs: SplunkLogEvent[]): Map<string, SplunkLogEvent[]> {
  const aggregatedErrors = new Map<string, SplunkLogEvent[]>();

  for (const log of logs) {
    // Extract error message from the log event
    const errorMessage = log.message || log.msg || log.error || '';
    
    if (!errorMessage) {
      continue; // Skip logs without error messages
    }

    const signature = generateErrorSignature(errorMessage);
    
    // Group logs by signature
    if (!aggregatedErrors.has(signature)) {
      aggregatedErrors.set(signature, []);
    }
    
    aggregatedErrors.get(signature)!.push(log);
  }

  return aggregatedErrors;
}

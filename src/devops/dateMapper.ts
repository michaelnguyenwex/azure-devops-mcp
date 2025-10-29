import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Loads the date mappings from mappingDates.json
 * Maps production deployment versions to UAT deploy dates
 * 
 * @returns Record mapping production deployment version strings to UAT deploy dates
 */
export function loadDateMappings(): Record<string, string> {
  try {
    const mappingPath = join(__dirname, 'mappingDates.json');
    const fileContents = readFileSync(mappingPath, 'utf-8');
    const mappings = JSON.parse(fileContents);
    
    console.log(`📅 Loaded ${Object.keys(mappings).length} date mappings`);
    
    return mappings;
  } catch (error) {
    console.error('❌ Failed to load date mappings:', error);
    throw new Error(`Failed to load date mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets the UAT target date for a given production deployment version
 * Supports multiple formats: "2026.Feb", "2026.02", etc.
 * 
 * @param prodDeployVersion - Production deployment version (e.g., "2026.Feb" or "2026.02")
 * @returns UAT deploy date string or null if not found
 */
export function getTargetDate(prodDeployVersion: string): string | null {
  try {
    console.log(`🔍 Looking up target date for: ${prodDeployVersion}`);
    
    const mappings = loadDateMappings();
    
    // Direct lookup
    if (mappings[prodDeployVersion]) {
      const targetDate = mappings[prodDeployVersion];
      console.log(`✅ Found target date: ${targetDate}`);
      return targetDate;
    }
    
    // Try alternate formats
    // If given "2026.Feb (Feb)", extract "2026.Feb"
    const cleanVersion = prodDeployVersion.replace(/\s*\(.*?\)\s*/, '').trim();
    if (mappings[cleanVersion]) {
      const targetDate = mappings[cleanVersion];
      console.log(`✅ Found target date (cleaned): ${targetDate}`);
      return targetDate;
    }
    
    console.warn(`⚠️  No target date found for: ${prodDeployVersion}`);
    return null;
  } catch (error) {
    console.error(`❌ Error getting target date for ${prodDeployVersion}:`, error);
    return null;
  }
}


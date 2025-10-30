/**
 * Date mappings for production deployment versions to UAT deploy dates
 * Maps production deployment versions to UAT deploy dates
 */
const DATE_MAPPINGS: Record<string, string> = {
  "2026.02": "2/10/2026",
  "2026.Feb": "2/10/2026",
  "2026.03": "3/10/2026",
  "2026.Mar": "3/10/2026",
  "2026.04": "4/7/2026",
  "2026.Apr": "4/7/2026",
  "2026.05": "5/5/2026",
  "2026.May": "5/5/2026",
  "2026.06": "6/2/2026",
  "2026.Jun": "6/2/2026",
  "2026.07": "6/30/2026",
  "2026.Jul": "6/30/2026",
  "2026.08": "7/28/2026",
  "2026.Aug": "7/28/2026",
  "2026.09": "8/25/2026",
  "2026.Sep": "8/25/2026",
  "2026.10": "9/22/2026",
  "2026.Oct": "9/22/2026",
  "2026.11": "10/20/2026",
  "2026.Nov": "10/20/2026",
  "2026.12": "11/17/2026",
  "2026.Dec": "11/17/2026"
};

/**
 * Gets the date mappings
 * Maps production deployment versions to UAT deploy dates
 * 
 * @returns Record mapping production deployment version strings to UAT deploy dates
 */
export function loadDateMappings(): Record<string, string> {
  console.log(`📅 Loaded ${Object.keys(DATE_MAPPINGS).length} date mappings`);
  return DATE_MAPPINGS;
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


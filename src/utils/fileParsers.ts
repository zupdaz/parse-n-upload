
import { toast } from "sonner";

export interface DissolutionResult {
  timePoints: number[];
  vessels: {
    [key: string]: number[];
  };
  average?: number[];
  stdDev?: number[];
}

export interface ParticleSizeResult {
  batchIds: string[];
  d10: number[];
  d50: number[];
  d90: number[];
  span?: number[];
  specificSurface?: number[];
}

/**
 * Parses a dissolution test file content
 * @param content - The file content as text
 * @returns The parsed dissolution data or null if parsing failed
 */
export const parseDissolutionFile = (content: string): DissolutionResult | null => {
  try {
    // Split content into lines and remove empty lines
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length < 2) {
      throw new Error("File contains insufficient data");
    }
    
    // Parse header to determine the vessel columns
    const header = lines[0].split(',').map(h => h.trim());
    
    // Find time point column index
    const timeColumnIndex = header.findIndex(h => 
      h.toLowerCase().includes('time') || h.toLowerCase().includes('point')
    );
    
    if (timeColumnIndex === -1) {
      throw new Error("Could not find time point column");
    }
    
    // Extract vessel column indices
    const vesselColumns = header
      .map((h, i) => ({ name: h, index: i }))
      .filter(col => 
        col.index !== timeColumnIndex && 
        (col.name.toLowerCase().includes('vessel') || /v\d+/i.test(col.name))
      );
    
    if (vesselColumns.length === 0) {
      throw new Error("Could not find vessel columns");
    }
    
    // Parse data rows
    const timePoints: number[] = [];
    const vessels: { [key: string]: number[] } = {};
    
    // Initialize vessel arrays
    vesselColumns.forEach(col => {
      vessels[col.name] = [];
    });
    
    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(cell => cell.trim());
      
      // Skip if row doesn't have enough columns
      if (row.length <= Math.max(timeColumnIndex, ...vesselColumns.map(c => c.index))) {
        continue;
      }
      
      // Parse time point
      const timeValue = parseFloat(row[timeColumnIndex]);
      if (isNaN(timeValue)) continue;
      timePoints.push(timeValue);
      
      // Parse vessel values
      vesselColumns.forEach(col => {
        const value = parseFloat(row[col.index]);
        vessels[col.name].push(isNaN(value) ? 0 : value);
      });
    }
    
    // Calculate average and standard deviation
    const average: number[] = [];
    const stdDev: number[] = [];
    
    for (let i = 0; i < timePoints.length; i++) {
      const values = vesselColumns.map(col => vessels[col.name][i]).filter(v => !isNaN(v));
      
      // Calculate average
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      average.push(avg);
      
      // Calculate standard deviation
      const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
      stdDev.push(Math.sqrt(variance));
    }
    
    return {
      timePoints,
      vessels,
      average,
      stdDev
    };
  } catch (error) {
    console.error("Error parsing dissolution file:", error);
    toast.error("Failed to parse dissolution file", {
      description: error instanceof Error ? error.message : "Unknown error"
    });
    return null;
  }
};

/**
 * Parses a particle size file content
 * @param content - The file content as text
 * @returns The parsed particle size data or null if parsing failed
 */
export const parseParticleSizeFile = (content: string): ParticleSizeResult | null => {
  try {
    // Split content into lines and remove empty lines
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length < 2) {
      throw new Error("File contains insufficient data");
    }
    
    // Parse header to determine the columns
    const header = lines[0].split(',').map(h => h.trim());
    
    // Find relevant column indices
    const batchColumnIndex = header.findIndex(h => 
      h.toLowerCase().includes('batch') || h.toLowerCase().includes('id')
    );
    
    const d10ColumnIndex = header.findIndex(h => 
      h.toLowerCase().includes('d10') || h.toLowerCase().includes('d(0.1)')
    );
    
    const d50ColumnIndex = header.findIndex(h => 
      h.toLowerCase().includes('d50') || h.toLowerCase().includes('d(0.5)')
    );
    
    const d90ColumnIndex = header.findIndex(h => 
      h.toLowerCase().includes('d90') || h.toLowerCase().includes('d(0.9)')
    );
    
    const spanColumnIndex = header.findIndex(h => 
      h.toLowerCase().includes('span')
    );
    
    const surfaceColumnIndex = header.findIndex(h => 
      h.toLowerCase().includes('surface') || h.toLowerCase().includes('area')
    );
    
    if (batchColumnIndex === -1 || d10ColumnIndex === -1 || d50ColumnIndex === -1 || d90ColumnIndex === -1) {
      throw new Error("Could not find required columns (batch ID, D10, D50, D90)");
    }
    
    // Initialize result arrays
    const batchIds: string[] = [];
    const d10: number[] = [];
    const d50: number[] = [];
    const d90: number[] = [];
    const span: number[] = [];
    const specificSurface: number[] = [];
    
    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(cell => cell.trim());
      
      // Skip if row doesn't have enough columns
      if (row.length <= Math.max(batchColumnIndex, d10ColumnIndex, d50ColumnIndex, d90ColumnIndex)) {
        continue;
      }
      
      // Extract data
      batchIds.push(row[batchColumnIndex]);
      d10.push(parseFloat(row[d10ColumnIndex]));
      d50.push(parseFloat(row[d50ColumnIndex]));
      d90.push(parseFloat(row[d90ColumnIndex]));
      
      // Optional data
      if (spanColumnIndex !== -1 && row[spanColumnIndex]) {
        span.push(parseFloat(row[spanColumnIndex]));
      }
      
      if (surfaceColumnIndex !== -1 && row[surfaceColumnIndex]) {
        specificSurface.push(parseFloat(row[surfaceColumnIndex]));
      }
    }
    
    return {
      batchIds,
      d10,
      d50,
      d90,
      span: span.length > 0 ? span : undefined,
      specificSurface: specificSurface.length > 0 ? specificSurface : undefined
    };
  } catch (error) {
    console.error("Error parsing particle size file:", error);
    toast.error("Failed to parse particle size file", {
      description: error instanceof Error ? error.message : "Unknown error"
    });
    return null;
  }
};

/**
 * Helper function to detect CSV delimiter (comma, semicolon, tab)
 */
export const detectDelimiter = (content: string): string => {
  const firstLine = content.split('\n')[0];
  
  const delimiters = [',', ';', '\t'];
  const counts = delimiters.map(d => (firstLine.match(new RegExp(d, 'g')) || []).length);
  
  const maxIndex = counts.indexOf(Math.max(...counts));
  return maxIndex !== -1 ? delimiters[maxIndex] : ',';
};

/**
 * Parse file content based on detected file type
 */
export const parseFileContent = async (file: File): Promise<DissolutionResult | ParticleSizeResult | null> => {
  try {
    // Read file content
    const content = await file.text();
    
    // Check file extension for initial type hint
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    // Basic content analysis for type detection
    const firstFewLines = content.split('\n').slice(0, 5).join(' ').toLowerCase();
    
    if (
      firstFewLines.includes('vessel') || 
      firstFewLines.includes('time point') ||
      file.name.toLowerCase().includes('diss')
    ) {
      return parseDissolutionFile(content);
    } else if (
      firstFewLines.includes('batch') || 
      firstFewLines.includes('particle') ||
      firstFewLines.includes('d10') || 
      firstFewLines.includes('d50') || 
      firstFewLines.includes('d90') ||
      file.name.toLowerCase().includes('part') ||
      file.name.toLowerCase().includes('size')
    ) {
      return parseParticleSizeFile(content);
    }
    
    // If type can't be determined, make a guess based on content structure
    if (content.includes('vessel') || content.match(/time\s*point/i)) {
      return parseDissolutionFile(content);
    } else {
      return parseParticleSizeFile(content);
    }
  } catch (error) {
    console.error("Error parsing file:", error);
    toast.error("Failed to parse file", {
      description: error instanceof Error ? error.message : "Unknown error"
    });
    return null;
  }
};

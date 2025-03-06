/**
 * Utility functions for parsing different types of data files
 */

// Types for parsed data
export interface DissolutionData {
  timePoint: number;
  vessels: number[];
  average?: number;
}

export interface ParticleData {
  batchId: string;
  d10: number;
  d50: number;
  d90: number;
  span: number;
  specificSurface: number;
  uniformity?: number;
  volumeMean?: number;
  submicronPercent?: number;
  timestamp?: string;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T[];
  error?: {
    message: string;
    details: string;
    line?: number;
    raw?: string;
  };
}

// Parse CSV content
const parseCSV = (content: string): string[][] => {
  const lines = content.split('\n');
  return lines.map(line => line.split(',').map(cell => cell.trim()));
};

// Parse dissolution test data
export const parseDissolutionData = (content: string): ParseResult<DissolutionData> => {
  try {
    const rows = parseCSV(content);
    
    // Validate header
    const header = rows[0];
    const timePointIndex = header.findIndex(col => col.toLowerCase().includes('time'));
    
    if (timePointIndex === -1) {
      throw new Error("Missing 'Time Point' column in header");
    }
    
    const vesselIndices: number[] = [];
    for (let i = 0; i < header.length; i++) {
      if (header[i].toLowerCase().includes('vessel')) {
        vesselIndices.push(i);
      }
    }
    
    if (vesselIndices.length === 0) {
      throw new Error("No 'Vessel' columns found in header");
    }
    
    if (vesselIndices.length < 6) {
      throw new Error(`Expected 6 vessel columns, but found ${vesselIndices.length}`);
    }
    
    // Parse data rows
    const data: DissolutionData[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length <= 1 || row.every(cell => cell === "")) continue; // Skip empty rows
      
      if (row.length < vesselIndices.length + 1) {
        throw {
          message: "Invalid row format",
          details: `Row ${i} has ${row.length} cells, but expected at least ${vesselIndices.length + 1}`,
          line: i,
          raw: rows[i].join(',')
        };
      }
      
      const timePoint = parseFloat(row[timePointIndex]);
      if (isNaN(timePoint)) {
        throw {
          message: "Invalid time point value",
          details: `Row ${i} has non-numeric time point: ${row[timePointIndex]}`,
          line: i,
          raw: rows[i].join(',')
        };
      }
      
      const vessels: number[] = [];
      for (const index of vesselIndices) {
        if (index < row.length) {
          const value = parseFloat(row[index]);
          if (isNaN(value)) {
            throw {
              message: "Invalid vessel value",
              details: `Row ${i}, column ${header[index]} has non-numeric value: ${row[index]}`,
              line: i,
              raw: rows[i].join(',')
            };
          }
          vessels.push(value);
        } else {
          throw {
            message: "Missing vessel value",
            details: `Row ${i} is missing value for ${header[index]}`,
            line: i,
            raw: rows[i].join(',')
          };
        }
      }
      
      // Calculate average
      const average = vessels.reduce((sum, value) => sum + value, 0) / vessels.length;
      
      data.push({
        timePoint,
        vessels,
        average
      });
    }
    
    return {
      success: true,
      data
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || "Failed to parse dissolution data",
        details: error.details || error.toString(),
        line: error.line,
        raw: error.raw
      }
    };
  }
};

// Parse particle size data with enhanced capabilities
export const parseParticleData = (content: string): ParseResult<ParticleData> => {
  try {
    const rows = parseCSV(content);
    
    // Check if file is empty or has too few rows
    if (rows.length < 2) {
      throw new Error("File is empty or has insufficient data rows");
    }
    
    // Extract header row and normalize column names for more flexible parsing
    const header = rows[0].map(h => h.toLowerCase().trim());
    
    // Define possible column names for each required field
    const columnMappings = {
      batch: ['batch', 'sample', 'id', 'identifier', 'sample id', 'batch id', 'batch number'],
      d10: ['d10', 'd(0.1)', 'd(v,0.1)', 'd[v,0.1]', 'dv10', 'd 10%', 'd10%'],
      d50: ['d50', 'd(0.5)', 'd(v,0.5)', 'd[v,0.5]', 'dv50', 'median', 'd 50%', 'd50%'],
      d90: ['d90', 'd(0.9)', 'd(v,0.9)', 'd[v,0.9]', 'dv90', 'd 90%', 'd90%'],
      span: ['span', 'width', 'distribution width', 'spread'],
      surface: ['surface', 'specific surface', 'specific surface area', 'ssa', 'surface area'],
      uniformity: ['uniformity', 'unif', 'u'],
      volumeMean: ['mean', 'volume mean', 'mean diameter', 'avg', 'average', 'd[4,3]', 'd(4,3)'],
      submicron: ['<1μm', '<1um', 'submicron', 'percent<1um', '%<1μm', '%<1um', 'percent < 1um'],
      timestamp: ['date', 'time', 'datetime', 'timestamp', 'measured on', 'date measured']
    };
    
    // Find column indices for each field
    const columnIndices: Record<string, number> = {};
    
    // Find best matching column for each required field
    for (const [field, possibleNames] of Object.entries(columnMappings)) {
      let foundIndex = -1;
      
      // Try exact matches first
      for (const name of possibleNames) {
        const exactIndex = header.findIndex(col => col === name);
        if (exactIndex !== -1) {
          foundIndex = exactIndex;
          break;
        }
      }
      
      // If no exact match, try contains
      if (foundIndex === -1) {
        for (const name of possibleNames) {
          const containsIndex = header.findIndex(col => col.includes(name));
          if (containsIndex !== -1) {
            foundIndex = containsIndex;
            break;
          }
        }
      }
      
      // For critical fields, throw error if not found
      if (foundIndex === -1 && ['batch', 'd10', 'd50', 'd90'].includes(field)) {
        throw new Error(`Required column for ${field} not found in header: ${header.join(', ')}`);
      }
      
      columnIndices[field] = foundIndex;
    }
    
    // Parse data rows
    const data: ParticleData[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length <= 1 || row.every(cell => cell === "")) continue; // Skip empty rows
      
      try {
        // Extract batch ID (required)
        const batchIdIndex = columnIndices['batch'];
        if (batchIdIndex === -1 || batchIdIndex >= row.length) {
          throw {
            message: "Missing batch ID column",
            details: `Row ${i} has no batch ID column identified`,
            line: i,
            raw: rows[i].join(',')
          };
        }
        
        const batchId = row[batchIdIndex];
        if (!batchId) {
          throw {
            message: "Missing batch ID value",
            details: `Row ${i} has empty batch ID`,
            line: i,
            raw: rows[i].join(',')
          };
        }
        
        // Helper function to parse numeric values with validation
        const parseNumericField = (field: string, required: boolean = true): number | undefined => {
          const index = columnIndices[field];
          if (index === -1 || index >= row.length) {
            if (required) {
              throw {
                message: `Missing ${field} column`,
                details: `Row ${i} has no ${field} column identified`,
                line: i,
                raw: rows[i].join(',')
              };
            }
            return undefined;
          }
          
          const valueStr = row[index];
          if (!valueStr && required) {
            throw {
              message: `Missing ${field} value`,
              details: `Row ${i} has empty ${field} value`,
              line: i,
              raw: rows[i].join(',')
            };
          }
          
          // Handle percentage values (strip % sign)
          const numericStr = valueStr.replace('%', '');
          const value = parseFloat(numericStr);
          
          if (isNaN(value) && required) {
            throw {
              message: `Invalid ${field} value`,
              details: `Row ${i} has non-numeric ${field}: ${valueStr}`,
              line: i,
              raw: rows[i].join(',')
            };
          }
          
          return isNaN(value) ? undefined : value;
        };
        
        // Parse required fields
        const d10 = parseNumericField('d10') as number;
        const d50 = parseNumericField('d50') as number;
        const d90 = parseNumericField('d90') as number;
        
        // Calculate span if not provided
        let span: number;
        if (columnIndices['span'] !== -1 && columnIndices['span'] < row.length) {
          span = parseNumericField('span') as number;
        } else {
          // Calculate span from d10, d50, and d90
          span = (d90 - d10) / d50;
        }
        
        // Parse optional fields
        const specificSurface = parseNumericField('surface', false) || 0;
        const uniformity = parseNumericField('uniformity', false);
        const volumeMean = parseNumericField('volumeMean', false);
        const submicronPercent = parseNumericField('submicron', false);
        
        // Parse timestamp if available
        let timestamp: string | undefined = undefined;
        if (columnIndices['timestamp'] !== -1 && columnIndices['timestamp'] < row.length) {
          timestamp = row[columnIndices['timestamp']];
        }
        
        // Create particle data entry
        const particleData: ParticleData = {
          batchId,
          d10,
          d50,
          d90,
          span,
          specificSurface
        };
        
        // Add optional fields if they exist
        if (uniformity !== undefined) particleData.uniformity = uniformity;
        if (volumeMean !== undefined) particleData.volumeMean = volumeMean;
        if (submicronPercent !== undefined) particleData.submicronPercent = submicronPercent;
        if (timestamp) particleData.timestamp = timestamp;
        
        data.push(particleData);
      } catch (rowError: any) {
        throw rowError;
      }
    }
    
    // If we got here with no data, that's an error
    if (data.length === 0) {
      throw new Error("No valid particle size data found in file");
    }
    
    return {
      success: true,
      data
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || "Failed to parse particle data",
        details: error.details || error.toString(),
        line: error.line,
        raw: error.raw
      }
    };
  }
};

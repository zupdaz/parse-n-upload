
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

// Parse particle size data
export const parseParticleData = (content: string): ParseResult<ParticleData> => {
  try {
    const rows = parseCSV(content);
    
    // Validate header
    const header = rows[0];
    const requiredColumns = ['batch', 'd10', 'd50', 'd90', 'span', 'surface'];
    
    const columnIndices: Record<string, number> = {};
    
    for (const required of requiredColumns) {
      const index = header.findIndex(col => col.toLowerCase().includes(required));
      if (index === -1) {
        throw new Error(`Missing required column that contains '${required}' in header`);
      }
      columnIndices[required] = index;
    }
    
    // Parse data rows
    const data: ParticleData[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length <= 1 || row.every(cell => cell === "")) continue; // Skip empty rows
      
      try {
        const batchId = row[columnIndices['batch']];
        if (!batchId) {
          throw {
            message: "Missing batch ID",
            details: `Row ${i} has no batch ID`,
            line: i,
            raw: rows[i].join(',')
          };
        }
        
        const d10 = parseFloat(row[columnIndices['d10']]);
        const d50 = parseFloat(row[columnIndices['d50']]);
        const d90 = parseFloat(row[columnIndices['d90']]);
        const span = parseFloat(row[columnIndices['span']]);
        const specificSurface = parseFloat(row[columnIndices['surface']]);
        
        if (isNaN(d10) || isNaN(d50) || isNaN(d90) || isNaN(span) || isNaN(specificSurface)) {
          throw {
            message: "Invalid numeric value",
            details: `Row ${i} has non-numeric values: d10=${row[columnIndices['d10']]}, d50=${row[columnIndices['d50']]}, d90=${row[columnIndices['d90']]}, span=${row[columnIndices['span']]}, specificSurface=${row[columnIndices['surface']]}`,
            line: i,
            raw: rows[i].join(',')
          };
        }
        
        data.push({
          batchId,
          d10,
          d50,
          d90,
          span,
          specificSurface
        });
      } catch (rowError: any) {
        throw rowError;
      }
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

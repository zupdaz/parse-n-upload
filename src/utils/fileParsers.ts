
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
  methodShort?: string;
  trial?: string;
  intermediateForm?: string;
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

// Helper regex functions for particle size parsing
const extractMethodShort = (value: string): [string | null, string] => {
  const pattern = /^(M[0-9][;,:]?)(.*)/;
  const match = value.match(pattern);
  if (match) {
    // Remove any punctuation from the end of the method string and strip whitespace
    return [match[1].replace(/[;,:]$/, ''), match[2].trim()];
  }
  return [null, value];
};

const extractTrial = (label: string): [string, string] => {
  const pattern = /([^, ]+)[, ]?(.*)/;
  const match = label.match(pattern);
  if (match) {
    return [match[1], match[2].trim()];
  }
  return [label, ''];
};

const extractTrialWithoutLetter = (s: string): string => {
  const pattern = /([A-Z]{3}\d{2}-\d[A-Z]\d{0,2})/i;
  const match = s.match(pattern);
  return match ? match[1] : s;
};

// Parse particle size data with enhanced capabilities
export const parseParticleData = (content: string): ParseResult<ParticleData> => {
  try {
    // Check if this might be a tab-delimited UTF-16 file in Mastersizer format
    if (content.includes('\t') && 
        (content.includes('Comment 1') || content.includes('Comment 2') || 
         content.includes('File  1') || content.includes('Size class'))) {
      return parseMastersizerData(content);
    }
    
    const rows = parseCSV(content);
    
    // Check if file is empty or has too few rows
    if (rows.length < 2) {
      throw new Error("File is empty or has insufficient data rows");
    }
    
    // Extract header row and normalize column names for more flexible parsing
    const header = rows[0].map(h => h.toLowerCase().trim());
    
    // Define possible column names for each required field
    const columnMappings = {
      batch: ['batch', 'sample', 'id', 'identifier', 'sample id', 'batch id', 'batch number', 'label', 'label_ou_sr', 'mra_no'],
      d10: ['d10', 'd(0.1)', 'd(v,0.1)', 'd[v,0.1]', 'dv10', 'd 10%', 'd10%'],
      d50: ['d50', 'd(0.5)', 'd(v,0.5)', 'd[v,0.5]', 'dv50', 'median', 'd 50%', 'd50%'],
      d90: ['d90', 'd(0.9)', 'd(v,0.9)', 'd[v,0.9]', 'dv90', 'd 90%', 'd90%'],
      span: ['span', 'width', 'distribution width', 'spread'],
      surface: ['surface', 'specific surface', 'specific surface area', 'ssa', 'surface area'],
      uniformity: ['uniformity', 'unif', 'u'],
      volumeMean: ['mean', 'volume mean', 'mean diameter', 'avg', 'average', 'd[4,3]', 'd(4,3)'],
      submicron: ['<1μm', '<1um', 'submicron', 'percent<1um', '%<1μm', '%<1um', 'percent < 1um'],
      timestamp: ['date', 'time', 'datetime', 'timestamp', 'measured on', 'date measured'],
      methodShort: ['method', 'method_short', 'test method'],
      trial: ['trial', 'trial id'],
      intermediateForm: ['intermediate', 'intermediate_form', 'form']
    };
    
    // Find column indices for each field
    const columnIndices: Record<string, number> = {};
    
    // Find best matching column for each field
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
          
          // Handle percentage values (strip % sign) and comma decimal separator
          const numericStr = valueStr.replace('%', '').replace(',', '.');
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
        
        // Helper function to parse text fields
        const parseTextField = (field: string): string | undefined => {
          const index = columnIndices[field];
          if (index === -1 || index >= row.length) {
            return undefined;
          }
          return row[index] || undefined;
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
        
        // Parse additional fields from Python parser
        let methodShort: string | undefined = undefined;
        let trial: string | undefined = undefined;
        let intermediateForm: string | undefined = undefined;
        
        // Get methodShort from column or extract from label
        if (columnIndices['methodShort'] !== -1 && columnIndices['methodShort'] < row.length) {
          methodShort = row[columnIndices['methodShort']];
        } else if (batchId) {
          const [extractedMethod] = extractMethodShort(batchId);
          if (extractedMethod) methodShort = extractedMethod;
        }
        
        // Get trial from column or extract from label
        if (columnIndices['trial'] !== -1 && columnIndices['trial'] < row.length) {
          trial = row[columnIndices['trial']];
        } else if (batchId) {
          const [extractedTrial] = extractTrial(batchId);
          if (extractedTrial) {
            trial = extractedTrial;
            // Try to extract trial without letter if it matches the pattern
            trial = extractTrialWithoutLetter(trial);
          }
        }
        
        // Get intermediateForm from column or extract from label
        if (columnIndices['intermediateForm'] !== -1 && columnIndices['intermediateForm'] < row.length) {
          intermediateForm = row[columnIndices['intermediateForm']];
        } else if (batchId) {
          const [_, extractedForm] = extractTrial(batchId);
          if (extractedForm) intermediateForm = extractedForm;
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
        if (methodShort) particleData.methodShort = methodShort;
        if (trial) particleData.trial = trial;
        if (intermediateForm) particleData.intermediateForm = intermediateForm;
        
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

// Enhanced Parse Mastersizer format files (similar to Python implementation)
const parseMastersizerData = (content: string): ParseResult<ParticleData> => {
  try {
    // Split the content into lines
    const lines = content.split('\n');
    if (lines.length < 10) {
      throw new Error("Mastersizer file has insufficient data");
    }

    // Determine file format type
    const isAlternativeFormat = content.includes('File  1') && content.includes('Size class');
    
    if (isAlternativeFormat) {
      return parseAlternativeMastersizerFormat(content);
    }
    
    // Find the blank rows that separate sections
    const blankRowIndices: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) {
        blankRowIndices.push(i);
        if (blankRowIndices.length >= 2) break;
      }
    }

    if (blankRowIndices.length < 2) {
      throw new Error("Couldn't find the required blank rows in Mastersizer file");
    }

    // Extract the metadata section (table2 in Python)
    const metadataSection = lines.slice(blankRowIndices[0] + 1, blankRowIndices[1]);
    const metadataRows = metadataSection.map(line => line.split('\t').map(cell => cell.trim()));
    
    // Transpose the metadata
    const metadata: Record<string, Record<string, string>> = {};
    const metadataHeaders = metadataRows[0].slice(1); // Skip the first column
    
    for (let i = 1; i < metadataRows.length; i++) {
      const row = metadataRows[i];
      const rowName = row[0]; // First column is the row name
      metadata[rowName] = {};
      
      for (let j = 1; j < row.length; j++) {
        if (j < metadataHeaders.length + 1) {
          metadata[rowName][metadataHeaders[j-1]] = row[j];
        }
      }
    }

    // Extract the data samples
    const dataSection = lines.slice(blankRowIndices[1] + 2); // Skip blank row and header
    const dataRows = dataSection
      .filter(line => line.trim()) // Skip empty lines
      .map(line => line.split('\t').map(cell => cell.trim()));
    
    // Process each sample in the data section
    const data: ParticleData[] = [];
    
    if (dataRows.length === 0 || !metadata["Comment 2"]) {
      throw new Error("Missing required data or Comment 2 metadata in Mastersizer file");
    }
    
    // Find columns for d10, d50, d90
    const d10Index = dataRows[0].findIndex(header => 
      header.toLowerCase().includes('d(0.1)') || header.toLowerCase().includes('d[0.1]'));
    const d50Index = dataRows[0].findIndex(header => 
      header.toLowerCase().includes('d(0.5)') || header.toLowerCase().includes('d[0.5]'));
    const d90Index = dataRows[0].findIndex(header => 
      header.toLowerCase().includes('d(0.9)') || header.toLowerCase().includes('d[0.9]'));
    const spanIndex = dataRows[0].findIndex(header => 
      header.toLowerCase().includes('span'));
    const ssaIndex = dataRows[0].findIndex(header => 
      header.toLowerCase().includes('specific surface') || header.toLowerCase().includes('surface area'));
    
    if (d10Index === -1 || d50Index === -1 || d90Index === -1) {
      throw new Error("Could not find required particle size distribution columns (d10, d50, d90)");
    }
    
    // Extract sample data
    for (const sampleName in metadata["Comment 2"]) {
      if (!Object.prototype.hasOwnProperty.call(metadata["Comment 2"], sampleName)) continue;
      
      try {
        const label = metadata["Comment 2"][sampleName];
        
        // Look for the corresponding row in data section
        let sampleRow = null;
        for (const row of dataRows.slice(1)) { // Skip header row
          if (row.length > 1 && row[1] === sampleName) {
            sampleRow = row;
            break;
          }
        }
        
        if (!sampleRow) {
          console.warn(`Couldn't find sample data for ${sampleName}`);
          continue;
        }
        
        // Parse the d values
        const d10 = parseFloat(sampleRow[d10Index].replace(',', '.'));
        const d50 = parseFloat(sampleRow[d50Index].replace(',', '.'));
        const d90 = parseFloat(sampleRow[d90Index].replace(',', '.'));
        
        // Calculate or extract span
        let span: number;
        if (spanIndex !== -1 && sampleRow[spanIndex]) {
          span = parseFloat(sampleRow[spanIndex].replace(',', '.'));
        } else {
          span = (d90 - d10) / d50;
        }
        
        // Parse specific surface area if available
        let specificSurface = 0;
        if (ssaIndex !== -1 && sampleRow[ssaIndex]) {
          specificSurface = parseFloat(sampleRow[ssaIndex].replace(',', '.'));
        }
        
        // Apply label parsing from Python
        const [methodShort, afterMethod] = extractMethodShort(label);
        const [trial, intermediateForm] = extractTrial(afterMethod || label);
        const extractedTrial = trial ? extractTrialWithoutLetter(trial) : undefined;
        
        // Create particle data
        const particleData: ParticleData = {
          batchId: label,
          d10,
          d50,
          d90,
          span,
          specificSurface
        };
        
        // Add the extracted metadata
        if (methodShort) particleData.methodShort = methodShort;
        if (extractedTrial) particleData.trial = extractedTrial;
        if (intermediateForm) particleData.intermediateForm = intermediateForm;
        
        // Add sample to results
        data.push(particleData);
      } catch (sampleError: any) {
        console.error(`Error processing sample: ${sampleError.message}`);
        // Continue with other samples rather than failing completely
      }
    }
    
    if (data.length === 0) {
      throw new Error("No valid particle size data found in Mastersizer file");
    }
    
    return {
      success: true,
      data
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || "Failed to parse Mastersizer particle data",
        details: error.details || error.toString()
      }
    };
  }
};

// Parse alternative Mastersizer format (similar to the Python code's structure)
const parseAlternativeMastersizerFormat = (content: string): ParseResult<ParticleData> => {
  try {
    // Split the content into lines
    const lines = content.split('\n');
    
    // Find the key sections in the file
    let fileTableEndIndex = -1;
    let parametersTableStartIndex = -1;
    let sizeClassTableStartIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('File 10') || line.includes('File  10')) {
        fileTableEndIndex = i;
      } else if (line.includes('Comment 1') && parametersTableStartIndex === -1) {
        parametersTableStartIndex = i;
      } else if (line.includes('Size class')) {
        sizeClassTableStartIndex = i;
      }
    }
    
    if (fileTableEndIndex === -1 || parametersTableStartIndex === -1) {
      throw new Error("Could not find required sections in the file structure");
    }
    
    // Parse the parameters table (metadata)
    const metadataRows = lines
      .slice(parametersTableStartIndex, sizeClassTableStartIndex)
      .filter(line => line.trim())
      .map(line => line.split('\t').map(cell => cell.trim()));
    
    // Find indices for critical columns: Comment 1 (MRA_no) and Comment 2 (Label_OU_SR)
    const headerRow = metadataRows[0];
    
    // Find the d10, d50, d90 rows
    let d10Row = -1;
    let d50Row = -1;
    let d90Row = -1;
    let spanRow = -1;
    let ssaRow = -1;
    
    for (let i = 0; i < metadataRows.length; i++) {
      const rowName = metadataRows[i][0]?.toLowerCase() || '';
      if (rowName.includes('x(q3=10.0 %)') || rowName.includes('d(0.1)') || rowName.includes('d10')) {
        d10Row = i;
      } else if (rowName.includes('x(q3=50.0 %)') || rowName.includes('d(0.5)') || rowName.includes('d50')) {
        d50Row = i;
      } else if (rowName.includes('x(q3=90.0 %)') || rowName.includes('d(0.9)') || rowName.includes('d90')) {
        d90Row = i;
      } else if (rowName.includes('span') || rowName.includes('span3')) {
        spanRow = i;
      } else if (rowName.includes('sv') || rowName.includes('surface') || rowName.includes('specific surface')) {
        ssaRow = i;
      }
    }
    
    if (d10Row === -1 || d50Row === -1 || d90Row === -1) {
      throw new Error("Could not find required particle size distribution rows (d10, d50, d90)");
    }
    
    // Extract Comment 1 and Comment 2 rows
    const comment1Row = metadataRows.findIndex(row => row[0]?.includes('Comment 1'));
    const comment2Row = metadataRows.findIndex(row => row[0]?.includes('Comment 2'));
    
    if (comment1Row === -1 || comment2Row === -1) {
      throw new Error("Could not find Comment 1 and Comment 2 rows");
    }
    
    // Process the data
    const data: ParticleData[] = [];
    
    // For each file/column, extract the particle data
    for (let fileIdx = 1; fileIdx <= 10; fileIdx++) {
      try {
        const colIdx = fileIdx; // Column index corresponds to file number
        
        // Skip if column doesn't exist in any row
        if (metadataRows[0].length <= colIdx) continue;
        
        const label = metadataRows[comment2Row][colIdx];
        if (!label || label === '') continue;
        
        // Extract d10, d50, d90 values
        const d10Str = metadataRows[d10Row][colIdx].replace(',', '.');
        const d50Str = metadataRows[d50Row][colIdx].replace(',', '.');
        const d90Str = metadataRows[d90Row][colIdx].replace(',', '.');
        
        if (!d10Str || !d50Str || !d90Str) continue;
        
        const d10 = parseFloat(d10Str);
        const d50 = parseFloat(d50Str);
        const d90 = parseFloat(d90Str);
        
        if (isNaN(d10) || isNaN(d50) || isNaN(d90)) continue;
        
        // Get span or calculate it
        let span: number;
        if (spanRow !== -1 && metadataRows[spanRow][colIdx]) {
          span = parseFloat(metadataRows[spanRow][colIdx].replace(',', '.'));
        } else {
          span = (d90 - d10) / d50;
        }
        
        // Get specific surface area if available
        let specificSurface = 0;
        if (ssaRow !== -1 && metadataRows[ssaRow][colIdx]) {
          specificSurface = parseFloat(metadataRows[ssaRow][colIdx].replace(',', '.'));
        }
        
        // Get MRA_no (Comment 1)
        const mraNo = metadataRows[comment1Row][colIdx];
        
        // Process label for additional metadata
        const [methodShort, afterMethod] = extractMethodShort(label);
        const [trial, intermediateForm] = extractTrial(afterMethod || label);
        const extractedTrial = trial ? extractTrialWithoutLetter(trial) : undefined;
        
        // Create the particle data entry
        const particleData: ParticleData = {
          batchId: label,
          d10,
          d50,
          d90,
          span,
          specificSurface
        };
        
        // Add additional metadata
        if (methodShort) particleData.methodShort = methodShort;
        if (extractedTrial) particleData.trial = extractedTrial;
        if (intermediateForm) particleData.intermediateForm = intermediateForm;
        if (mraNo) particleData.timestamp = mraNo; // Use timestamp field to store MRA_no
        
        data.push(particleData);
      } catch (error) {
        console.error(`Error processing file column ${fileIdx}:`, error);
        // Continue with other columns rather than failing
      }
    }
    
    if (data.length === 0) {
      throw new Error("No valid particle size data could be extracted from the file");
    }
    
    return {
      success: true,
      data
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || "Failed to parse alternative Mastersizer format",
        details: error.details || error.toString()
      }
    };
  }
};

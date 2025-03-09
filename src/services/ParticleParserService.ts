
import Papa from 'papaparse';

/**
 * A JavaScript implementation of the CAM particle size file parser
 * based on the Python implementation.
 */

// Set up console logging functions for parser
const logger = {
  debug: (message: string) => console.debug(`[ParticleParser] ${message}`),
  info: (message: string) => console.info(`[ParticleParser] ${message}`),
  warn: (message: string) => console.warn(`[ParticleParser] ${message}`),
  error: (message: string, error?: any) => {
    console.error(`[ParticleParser] ${message}`);
    if (error) console.error(error);
  }
};

// Helper function to convert text to UTF-16 if needed
async function convertToUTF16IfNeeded(file: File): Promise<string> {
  try {
    // Try UTF-16 first
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-16le');
    const text = decoder.decode(arrayBuffer);
    
    // Simple heuristic: check if the text contains valid content
    // UTF-16 files usually have specific markers, so if we see strange chars at the beginning,
    // it's likely decoded correctly
    if (text.charAt(0) !== '\uFEFF' && text.length > 0 && !text.startsWith('�')) {
      logger.info(`File appears to be UTF-16 encoded`);
      return text;
    }
    
    // Fallback to UTF-8
    logger.info(`File does not appear to be UTF-16, falling back to UTF-8`);
    const utf8Decoder = new TextDecoder('utf-8');
    return utf8Decoder.decode(arrayBuffer);
  } catch (error) {
    logger.error(`Error converting file encoding`, error);
    // Fallback to regular text
    return await file.text();
  }
}

// Parse tab-delimited file to find blank rows
function findBlankRows(content: string): { blankRowIndices: Record<number, number>, totalRows: number } {
  logger.debug('Finding blank rows in file');
  const lines = content.split('\n');
  let t1Rows = 0;
  let blankRowCount = 0;
  const blankRowIndices: Record<number, number> = {};

  for (const line of lines) {
    t1Rows++;
    
    // Check if line is empty or just contains whitespace
    const trimmedLine = line.trim();
    if (trimmedLine === '' || !trimmedLine.split('\t')[0]) {
      blankRowCount++;
      blankRowIndices[blankRowCount] = t1Rows;
      logger.debug(`Found blank row #${blankRowCount} at line ${t1Rows}`);
      
      if (blankRowCount === 2) {
        break;
      }
    }
  }
  
  return { blankRowIndices, totalRows: t1Rows };
}

// Parse tab-delimited file into a DataFrame-like structure
function parseTabDelimited(content: string, options: {
  skipRows?: number, 
  nRows?: number,
  hasHeader?: boolean,
  indexCol?: number
} = {}): any[] {
  const { skipRows = 0, nRows, hasHeader = true, indexCol } = options;
  
  // Parse the CSV content
  const parsed = Papa.parse(content, {
    delimiter: '\t',
    skipEmptyLines: true,
    header: hasHeader
  });
  
  const rows = parsed.data as any[];
  let result = rows.slice(skipRows, nRows ? skipRows + nRows : undefined);
  
  // If indexCol is specified, use it as the index
  if (indexCol !== undefined && result.length > 0) {
    const indexed: Record<string, any> = {};
    for (const row of result) {
      const indexValue = row[Object.keys(row)[indexCol]];
      indexed[indexValue] = row;
    }
    return indexed;
  }
  
  return result;
}

// Transpose a matrix (array of arrays)
function transpose(matrix: any[][]): any[][] {
  if (matrix.length === 0) return [];
  
  return matrix[0].map((_, colIndex) => 
    matrix.map(row => row[colIndex])
  );
}

// Convert comma-separated decimal values to dot notation
function convertDecimal(value: string): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  // Replace comma with dot for decimal notation
  return parseFloat(value.replace(',', '.'));
}

// Main parser function
export async function parseParticleFile(file: File): Promise<{
  success: boolean;
  data?: any[];
  error?: {
    message: string;
    details: string;
    line?: number;
    raw?: string;
  };
}> {
  try {
    logger.info(`Starting to parse particle size file: ${file.name}`);
    
    // Read file content with UTF-16 encoding if needed
    const content = await convertToUTF16IfNeeded(file);
    
    // Find blank rows in the file
    const { blankRowIndices, totalRows } = findBlankRows(content);
    
    if (Object.keys(blankRowIndices).length < 2) {
      const error = "Could not locate two distinct blank rows in the file. Check file format.";
      logger.error(error);
      return {
        success: false,
        error: {
          message: "Invalid file format",
          details: error
        }
      };
    }
    
    const blankRow1 = blankRowIndices[1];
    const blankRow2 = blankRowIndices[2];
    const numRowsBetweenBlankRows = blankRow2 - blankRow1 - 2;
    
    logger.debug(`First blank row at line ${blankRow1}, second at ${blankRow2}`);
    logger.debug(`Number of rows between blank rows: ${numRowsBetweenBlankRows}`);
    
    // Parse the file sections
    const lines = content.split('\n');
    
    // Create table2 (metadata)
    logger.debug("Parsing table2 (metadata)");
    const table2Lines = lines.slice(blankRow1, blankRow1 + numRowsBetweenBlankRows + 1);
    const table2Content = table2Lines.join('\n');
    
    const table2Raw = parseTabDelimited(table2Content, { 
      hasHeader: false,
      indexCol: 0
    });
    
    // Transpose table2
    const table2Keys = Object.keys(table2Raw);
    const table2Transposed: Record<string, any>[] = [];
    
    if (table2Keys.length > 0) {
      const firstItem = table2Raw[table2Keys[0]];
      const headerKeys = Object.keys(firstItem);
      
      for (const key of table2Keys) {
        const row: Record<string, any> = {};
        for (const headerKey of headerKeys) {
          row[headerKey] = table2Raw[key][headerKey];
        }
        table2Transposed.push(row);
      }
    }
    
    // Create table3 (measurement data)
    logger.debug("Parsing table3 (measurement data)");
    const table3Lines = lines.slice(blankRow2 + 2, blankRow2 + 102); // Maximum 100 rows
    const table3Content = table3Lines.join('\n');
    
    const table3 = parseTabDelimited(table3Content, { hasHeader: false });
    
    // Process tables to create chart data
    logger.debug("Processing tables to create chart data");
    const chartData: Record<string, Record<string, number>> = {};
    
    // Process rows in table3
    for (let idx = 0; idx < table3.length; idx++) {
      const rowData = table3[idx];
      const rowValues = Object.values(rowData);
      const colLabel = String(rowValues[1]); // The second column contains the label
      
      // Process data columns starting from the third column
      for (let i = 2; i < rowValues.length; i++) {
        const fileKey = Object.keys(rowData)[i];
        
        try {
          // Get row key from table2 (Comment 2 field)
          const comment2Value = table2Transposed.find(
            item => Object.keys(item)[0] === fileKey
          )?.["Comment 2"];
          
          if (!comment2Value) continue;
          
          const rowKey = String(comment2Value);
          const value = convertDecimal(String(rowValues[i]));
          
          if (!chartData[rowKey]) {
            chartData[rowKey] = {};
          }
          
          chartData[rowKey][colLabel] = value;
        } catch (e) {
          logger.warn(`Skipping data point due to error at idx=${idx}, i=${i}`, e);
        }
      }
    }
    
    // Create chart table from chart data
    const chartTable: Record<string, any>[] = Object.keys(chartData).map(key => {
      return { 
        rowKey: key,
        "0.1": 0.00,
        ...chartData[key]
      };
    });
    
    // Process table2 into data table
    logger.debug("Processing metadata table");
    const dataTable = table2Transposed.map(row => {
      const newRow: Record<string, any> = {};
      
      // Convert keys to proper column names
      Object.entries(row).forEach(([key, value]) => {
        if (key === "Comment 1") {
          newRow["MRA_no"] = value;
        } else if (key === "Comment 2") {
          newRow["Label_OU_SR"] = value;
        } else {
          newRow[key] = value;
        }
      });
      
      // Convert numeric columns
      Object.keys(newRow).slice(2).forEach(key => {
        if (newRow[key] && typeof newRow[key] === 'string') {
          newRow[key] = convertDecimal(newRow[key]);
        }
      });
      
      return newRow;
    });
    
    // Combine data_table & chart_table side-by-side
    logger.debug("Combining data and chart tables");
    const combinedTable = dataTable.map((row, idx) => {
      if (idx >= chartTable.length) return row;
      
      return {
        ...row,
        ...chartTable[idx]
      };
    });
    
    // Apply text extraction for labels
    logger.debug("Extracting and formatting label information");
    const processedTable = combinedTable.map(row => {
      const newRow = { ...row };
      
      // Extract method_short
      const labelValue = String(row["Label_OU_SR"] || "");
      const methodShortMatch = /^(M[0-9][;,:]?)(.*)/.exec(labelValue);
      
      let methodShort = null;
      let newLabel = labelValue;
      
      if (methodShortMatch) {
        methodShort = methodShortMatch[1].replace(/[;,:]+$/, "");
        newLabel = methodShortMatch[2].trim();
      }
      
      newRow["Method_short"] = methodShort;
      newRow["Label_OU_SR"] = newLabel;
      
      // Extract trial and intermediate form
      const trialMatch = /([^, ]+)[, ]?(.*)/.exec(newLabel);
      let trial = newLabel;
      let intermediateForm = "";
      
      if (trialMatch) {
        trial = trialMatch[1];
        intermediateForm = trialMatch[2].trim();
      }
      
      newRow["Trial"] = trial;
      newRow["Intermediate_Form"] = intermediateForm;
      
      // Extract batch
      const batchMatch = /([A-Z]{3}\d{2}-\d[A-Z]\d{0,2})/i.exec(trial);
      newRow["Batch"] = batchMatch ? batchMatch[1] : trial;
      
      return newRow;
    });
    
    // Unpivot the table to get size class data
    logger.debug("Creating final unpivoted data table");
    const finalTable: any[] = [];
    
    processedTable.forEach(row => {
      const idVars = Object.keys(row).filter(key => {
        // Check if the key is a size class key (numeric)
        const isNumeric = !isNaN(parseFloat(key));
        return !isNumeric;
      });
      
      const valueVars = Object.keys(row).filter(key => {
        // Check if the key is a size class key (numeric)
        return !isNaN(parseFloat(key));
      });
      
      valueVars.forEach(sizeClass => {
        const newRow: Record<string, any> = {};
        
        // Add ID variables
        idVars.forEach(key => {
          newRow[key] = row[key];
        });
        
        // Add value variables
        newRow["Size_class"] = sizeClass;
        newRow["Value"] = row[sizeClass];
        
        finalTable.push(newRow);
      });
    });
    
    logger.info(`Parsing completed successfully. Generated ${finalTable.length} data points.`);
    return {
      success: true,
      data: finalTable
    };
  } catch (error: any) {
    logger.error(`Error in particle file parser: ${error.message}`, error);
    return {
      success: false,
      error: {
        message: error.message || "Unknown parsing error",
        details: error.stack || "No details available"
      }
    };
  }
}


import { toast } from "sonner";

export interface ParticleParsingResult {
  success: boolean;
  data?: any[];
  error?: {
    message: string;
    details: string;
    line?: number;
    raw?: string;
  };
}

export const parseParticleFile = async (file: File): Promise<ParticleParsingResult> => {
  try {
    console.log(`Parsing file ${file.name} for CAM/particle size data`);
    
    // Read the file content
    const fileContent = await file.arrayBuffer();
    const decoder = new TextDecoder("utf-16");
    const content = decoder.decode(fileContent);
    
    return parseCAMFile(content, file.name);
  } catch (error) {
    console.error("Error in parseParticleFile:", error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: {
        message: 'Failed to parse particle file',
        details: `Error: ${errorMessage}`
      }
    };
  }
};

export const parseCAMFile = (content: string, fileName: string): ParticleParsingResult => {
  try {
    console.log(`Starting to parse CAM file: ${fileName}`);
    
    // Split content into lines and handle both CRLF and LF line endings
    const lines = content.split(/\r?\n/);
    
    // Find blank rows (completely empty or with empty first column)
    let t1Rows = 0;
    let blankRowCount = 0;
    const blankRows: Record<number, number> = {};
    
    for (let i = 0; i < lines.length; i++) {
      t1Rows++;
      const line = lines[i];
      const columns = line.split('\t');
      
      // If line is empty or first column is empty
      if (!line || !columns[0]) {
        blankRowCount++;
        blankRows[blankRowCount] = t1Rows;
        
        // Stop after finding the second blank row
        if (blankRowCount === 2) {
          break;
        }
      }
    }
    
    // Validate we found two blank rows
    if (blankRowCount < 2) {
      console.error("Could not locate two distinct blank rows in the file");
      return {
        success: false,
        error: {
          message: 'Invalid file format',
          details: 'Could not locate two distinct blank rows in the file. Check file format.'
        }
      };
    }
    
    const blankRow1 = blankRows[1];
    const blankRow2 = blankRows[2];
    const numRowsBetweenBlankRows = blankRow2 - blankRow1 - 2;
    
    console.log(`Blank rows detected at: ${blankRow1} and ${blankRow2}`);
    
    // Read table2 (metadata between the blank rows)
    const table2Headers: string[] = [];
    const table2Data: Record<string, Record<string, string>> = {};
    
    for (let i = blankRow1; i < blankRow1 + numRowsBetweenBlankRows + 1; i++) {
      if (i >= lines.length) break;
      
      const row = lines[i].split('\t');
      if (row.length < 2) continue;
      
      const rowKey = row[0];
      if (!rowKey) continue;
      
      if (i === blankRow1) {
        // First row contains column headers
        for (let j = 1; j < row.length; j++) {
          if (row[j]) {
            table2Headers.push(row[j]);
          }
        }
      } else {
        // Data rows
        for (let j = 1; j < row.length; j++) {
          const header = table2Headers[j - 1];
          if (!header) continue;
          
          if (!table2Data[header]) {
            table2Data[header] = {};
          }
          
          table2Data[header][rowKey] = row[j] || '';
        }
      }
    }
    
    // Transpose table2 to match pandas transpose operation
    const table2Transposed: Record<string, Record<string, string>> = {};
    for (const header of table2Headers) {
      const columnData = table2Data[header];
      if (!columnData) continue;
      
      for (const rowKey in columnData) {
        if (!table2Transposed[header]) {
          table2Transposed[header] = {};
        }
        table2Transposed[header][rowKey] = columnData[rowKey];
      }
    }
    
    // Read table3 (measurement data after the second blank row)
    const table3: any[] = [];
    for (let i = blankRow2 + 2; i < blankRow2 + 102; i++) {
      if (i >= lines.length) break;
      
      const row = lines[i].split('\t');
      if (row.length < 3) continue;
      
      const rowObj: Record<string, any> = {};
      for (let j = 0; j < row.length; j++) {
        // Replace comma with dot for decimal values
        let value = row[j].replace(',', '.');
        
        // Try to convert to number if possible
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          value = numValue;
        }
        
        rowObj[j] = value;
      }
      
      table3.push(rowObj);
    }
    
    // Process table data
    const dataTable: Record<string, any>[] = [];
    const chartTable: Record<string, any>[] = [];
    const tmpChartData: Record<string, Record<string, number>> = {};
    
    // Process table3 to build chart data
    for (const rowData of table3) {
      const colLabel = rowData[1];
      
      // Process data columns starting from the third column
      for (let j = 2; j < Object.keys(rowData).length; j++) {
        const fileKey = j.toString();
        
        try {
          // Find the Comment 2 value for this file in table2
          let rowKey = '';
          for (const header of table2Headers) {
            if (table2Transposed[header] && table2Transposed[header]['Comment 2']) {
              rowKey = table2Transposed[header]['Comment 2'];
              break;
            }
          }
          
          if (!rowKey) continue;
          
          const value = parseFloat(rowData[j]);
          if (isNaN(value)) continue;
          
          if (!tmpChartData[rowKey]) {
            tmpChartData[rowKey] = {};
          }
          
          tmpChartData[rowKey][colLabel] = value;
        } catch (error) {
          console.warn('Skipping data point due to error:', error);
        }
      }
    }
    
    // Convert tmpChartData to array
    for (const rowKey in tmpChartData) {
      const row: Record<string, any> = { ...tmpChartData[rowKey], '0.1': 0.00 };
      chartTable.push(row);
    }
    
    // Process table2Transposed to dataTable
    for (const header of table2Headers) {
      const columnData = table2Transposed[header];
      if (!columnData) continue;
      
      const row: Record<string, any> = {};
      for (const key in columnData) {
        let value = columnData[key];
        
        // Convert numeric values
        if (key !== 'Comment 1' && key !== 'Comment 2') {
          const numValue = parseFloat(value.replace(',', '.'));
          if (!isNaN(numValue)) {
            value = numValue;
          }
        }
        
        row[key] = value;
      }
      
      dataTable.push(row);
    }
    
    // Combine dataTable and chartTable
    const camTable: Record<string, any>[] = [];
    for (let i = 0; i < Math.max(dataTable.length, chartTable.length); i++) {
      const row: Record<string, any> = {};
      
      // Add data from dataTable
      if (i < dataTable.length) {
        for (const key in dataTable[i]) {
          if (key === 'Comment 1') {
            row['MRA_no'] = dataTable[i][key];
          } else if (key === 'Comment 2') {
            row['Label_OU_SR'] = dataTable[i][key];
          } else {
            row[key] = dataTable[i][key];
          }
        }
      }
      
      // Add data from chartTable
      if (i < chartTable.length) {
        for (const key in chartTable[i]) {
          row[key] = chartTable[i][key];
        }
      }
      
      camTable.push(row);
    }
    
    // Extract and modify Label_OU_SR, inserting new columns
    const extractMethodShort = (value: string): [string | null, string] => {
      const pattern = /^(M[0-9][;,:]?)(.*)/;
      const match = value.match(pattern);
      if (match) {
        return [match[1].replace(/[;,:]$/, ''), match[2].trim()];
      }
      return [null, value];
    };
    
    const extractTrial = (s: string): [string, string] => {
      const pattern = /([^, ]+)[, ]?(.*)/;
      const match = s.match(pattern);
      if (match) {
        return [match[1], match[2].trim()];
      }
      return [s, ''];
    };
    
    const extractTrialWithoutLetter = (s: string): string => {
      const pattern = /([A-Z]{3}\d{2}-\d[A-Z]\d{0,2})/i;
      const match = s.match(pattern);
      return match ? match[1] : s;
    };
    
    // Apply the extraction functions to camTable
    for (const row of camTable) {
      if (row['Label_OU_SR']) {
        const [methodShort, labelOuSr] = extractMethodShort(row['Label_OU_SR']);
        row['Method_short'] = methodShort;
        row['Label_OU_SR'] = labelOuSr;
        
        const [trial, intermediateForm] = extractTrial(row['Label_OU_SR']);
        row['Trial'] = trial;
        row['Intermediate_Form'] = intermediateForm;
        row['Batch'] = extractTrialWithoutLetter(trial);
      }
    }
    
    // Unpivot the data (melt operation)
    const camTableUnpivot: Record<string, any>[] = [];
    const sizeClasses = Object.keys(camTable[0] || {}).filter(key => !isNaN(parseFloat(key)));
    
    for (const row of camTable) {
      for (const sizeClass of sizeClasses) {
        const unpivotRow: Record<string, any> = {};
        
        // Copy non-size class columns
        for (const key in row) {
          if (!sizeClasses.includes(key)) {
            unpivotRow[key] = row[key];
          }
        }
        
        // Add size class and value
        unpivotRow['Size_class'] = sizeClass;
        unpivotRow['Value'] = row[sizeClass];
        
        camTableUnpivot.push(unpivotRow);
      }
    }
    
    console.log(`Parsing completed successfully, generated ${camTableUnpivot.length} data points`);
    
    return {
      success: true,
      data: camTableUnpivot
    };
  } catch (error) {
    console.error('Error parsing CAM file:', error);
    return {
      success: false,
      error: {
        message: 'Failed to parse CAM file',
        details: error instanceof Error ? error.message : String(error)
      }
    };
  }
};

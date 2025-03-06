
/**
 * Utility functions for generating sample CSV and XLSX files for testing
 */

// Sample data for dissolution test results
const dissolutionData = [
  { timePoint: 5, vessel1: 10.2, vessel2: 11.5, vessel3: 9.8, vessel4: 10.5, vessel5: 11.2, vessel6: 10.9 },
  { timePoint: 10, vessel1: 25.7, vessel2: 26.3, vessel3: 24.9, vessel4: 25.8, vessel5: 26.5, vessel6: 25.2 },
  { timePoint: 15, vessel1: 42.1, vessel2: 41.6, vessel3: 40.8, vessel4: 42.5, vessel5: 43.2, vessel6: 41.9 },
  { timePoint: 30, vessel1: 68.3, vessel2: 67.9, vessel3: 66.5, vessel4: 69.1, vessel5: 68.7, vessel6: 67.4 },
  { timePoint: 45, vessel1: 85.4, vessel2: 84.6, vessel3: 83.9, vessel4: 86.2, vessel5: 85.8, vessel6: 84.5 },
  { timePoint: 60, vessel1: 95.7, vessel2: 94.9, vessel3: 93.8, vessel4: 96.3, vessel5: 95.9, vessel6: 94.5 }
];

// Sample data for particle size analysis
const particleData = [
  { batchId: "B23001", d10: 0.8, d50: 5.4, d90: 12.6, span: 2.18, specificSurface: 12500 },
  { batchId: "B23002", d10: 0.9, d50: 5.6, d90: 12.9, span: 2.14, specificSurface: 12200 },
  { batchId: "B23003", d10: 0.7, d50: 5.2, d90: 12.3, span: 2.23, specificSurface: 13000 },
  { batchId: "B23004", d10: 0.85, d50: 5.5, d90: 12.7, span: 2.16, specificSurface: 12350 },
  { batchId: "B23005", d10: 0.75, d50: 5.3, d90: 12.5, span: 2.21, specificSurface: 12800 }
];

// Error sample data - Missing columns in dissolution data
const errorDissolutionData = [
  // Missing vessel3 column
  { timePoint: 5, vessel1: 10.2, vessel2: 11.5, vessel4: 10.5, vessel5: 11.2, vessel6: 10.9 },
  { timePoint: 10, vessel1: 25.7, vessel2: 26.3, vessel4: 25.8, vessel5: 26.5, vessel6: 25.2 },
];

// Error sample data - Invalid values in particle data
const errorParticleData = [
  { batchId: "B23001", d10: "invalid", d50: 5.4, d90: 12.6, span: 2.18, specificSurface: 12500 },
  { batchId: "B23002", d10: 0.9, d50: "N/A", d90: 12.9, span: 2.14, specificSurface: 12200 },
];

// Convert data to CSV format
export const generateDissolutionCSV = (): string => {
  const header = "Time Point,Vessel 1,Vessel 2,Vessel 3,Vessel 4,Vessel 5,Vessel 6";
  const rows = dissolutionData.map(row => 
    `${row.timePoint},${row.vessel1},${row.vessel2},${row.vessel3},${row.vessel4},${row.vessel5},${row.vessel6}`
  );
  return [header, ...rows].join('\n');
};

export const generateParticleCSV = (): string => {
  const header = "Batch ID,D10 (μm),D50 (μm),D90 (μm),Span,Specific Surface (cm²/g)";
  const rows = particleData.map(row => 
    `${row.batchId},${row.d10},${row.d50},${row.d90},${row.span},${row.specificSurface}`
  );
  return [header, ...rows].join('\n');
};

// Generate error-containing files
export const generateErrorDissolutionCSV = (): string => {
  const header = "Time Point,Vessel 1,Vessel 2,Vessel 4,Vessel 5,Vessel 6";
  const rows = errorDissolutionData.map(row => 
    `${row.timePoint},${row.vessel1},${row.vessel2},${row.vessel4},${row.vessel5},${row.vessel6}`
  );
  return [header, ...rows].join('\n');
};

export const generateErrorParticleCSV = (): string => {
  const header = "Batch ID,D10 (μm),D50 (μm),D90 (μm),Span,Specific Surface (cm²/g)";
  const rows = errorParticleData.map(row => 
    `${row.batchId},${row.d10},${row.d50},${row.d90},${row.span},${row.specificSurface}`
  );
  return [header, ...rows].join('\n');
};

// Function to create and trigger download of a sample file
export const downloadSampleFile = (fileType: "dissolution-csv" | "particle-csv" | "error-dissolution-csv" | "error-particle-csv") => {
  let content = '';
  let filename = '';
  
  switch (fileType) {
    case "dissolution-csv":
      content = generateDissolutionCSV();
      filename = "sample_dissolution_data.csv";
      break;
    case "particle-csv":
      content = generateParticleCSV();
      filename = "sample_particle_size_data.csv";
      break;
    case "error-dissolution-csv":
      content = generateErrorDissolutionCSV();
      filename = "sample_dissolution_error_data.csv";
      break;
    case "error-particle-csv":
      content = generateErrorParticleCSV();
      filename = "sample_particle_error_data.csv";
      break;
  }
  
  // Create a blob and download link
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

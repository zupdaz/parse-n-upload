
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { UploadJob } from "@/components/UploadProgress";
import { parseDissolutionData, parseParticleData, ParseResult } from "@/utils/fileParsers";
import { parseParticleFile } from "@/services/ParticleParserService";

export interface ParseError {
  fileName: string;
  message: string;
  details: string;
  line?: number;
  raw?: string;
}

export function useFileUpload() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [currentError, setCurrentError] = useState<ParseError | null>(null);
  
  // More accurate file type detection based on content
  const detectFileType = async (file: File): Promise<"dissolution" | "particle" | "cam" | undefined> => {
    try {
      // Automatically categorize CSV files as CAM (particle size files)
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'csv') {
        logger.log(`${file.name} automatically categorized as cam (CSV file)`);
        return "cam";
      }
      
      // Read first few lines of the file
      const chunk = await file.slice(0, 5000).text();
      const lines = chunk.toLowerCase().split('\n');
      const joinedLines = lines.join(' ');
      
      logger.log(`Detecting file type for ${file.name}`);
      
      // Look for specific CAM particle size indicators - SPAN3 is specific to particle size files
      if (joinedLines.includes('span3')) {
        logger.log(`${file.name} detected as cam (found SPAN3)`);
        return "cam";
      }
      
      // Look for keywords to identify dissolution file type
      if (joinedLines.includes('vessel') && 
          (joinedLines.includes('time point') || joinedLines.includes('timepoint'))) {
        logger.log(`${file.name} detected as dissolution`);
        return "dissolution";
      } 
      
      // Check for Mastersize particle format (CAM format)
      if ((joinedLines.includes('comment 1') && joinedLines.includes('comment 2')) || 
          (joinedLines.includes('x(q3=10.0 %)') || joinedLines.includes('x(q3=50.0 %)'))) {
        logger.log(`${file.name} detected as cam format (Mastersize format)`);
        return "cam";
      }
      
      // Check for standard particle format
      if (joinedLines.includes('batch') && 
         (joinedLines.includes('d10') || joinedLines.includes('d50') || joinedLines.includes('d90'))) {
        logger.log(`${file.name} detected as particle (standard format)`);
        return "particle";
      }
      
      // If can't detect from content, make a guess based on name and extension
      if (file.name.toLowerCase().includes('diss')) {
        logger.log(`${file.name} guessed as dissolution based on filename`);
        return "dissolution";
      } else if (file.name.toLowerCase().includes('part') || 
                file.name.toLowerCase().includes('size') ||
                file.name.toLowerCase().includes('gran') ||
                file.name.toLowerCase().includes('cam') ||
                extension === 'xlsx' || 
                extension === 'xlsm') {
        logger.log(`${file.name} guessed as cam based on filename or extension`);
        return "cam";
      }
      
      // Default fallback - if in doubt, treat as CAM for CSV files
      logger.log(`${file.name} could not determine specific type, treating as cam`);
      return "cam";
    } catch (error) {
      logger.error("Error detecting file type:", error);
      return "cam"; // Default to CAM as a fallback
    }
  };
  
  // Setup a logger
  const logger = {
    log: (message: string) => console.log(`[FileUpload] ${message}`),
    error: (message: string, error?: any) => {
      console.error(`[FileUpload] ${message}`);
      if (error) console.error(error);
    }
  };
  
  const createUploadJob = async (file: File): Promise<UploadJob> => {
    const fileType = await detectFileType(file);
    return {
      id: uuidv4(),
      fileName: file.name,
      status: "queued",
      progress: 0,
      fileType,
      createdAt: new Date()
    };
  };
  
  const parseFile = async (file: File, fileType: "dissolution" | "particle" | "cam" | undefined): Promise<ParseResult<any>> => {
    try {
      logger.log(`Parsing ${file.name} as ${fileType || 'unknown'} type`);
      
      if (fileType === "dissolution") {
        logger.log(`Using dissolution parser for ${file.name}`);
        return parseDissolutionData(await file.text());
      } else if (fileType === "cam") {
        logger.log(`Using CAM parser for ${file.name}`);
        // Use the JavaScript CAM parser (polarjs equivalent)
        const result = await parseParticleFile(file);
        logger.log(`CAM parser result: success=${result.success}, dataLength=${result.data?.length || 0}`);
        return result;
      } else if (fileType === "particle") {
        logger.log(`Using standard JS particle parser for ${file.name}`);
        // Use the standard JS parser for other particle size formats
        return parseParticleData(await file.text());
      } else {
        // Try both parsers if type is not determined
        logger.log(`Trying multiple parsers for ${file.name}`);
        try {
          // First try CAM parser since it's our preferred format
          logger.log(`${file.name} trying CAM parser first`);
          const result = await parseParticleFile(file);
          if (result.success) {
            return result;
          }
          
          // Then try dissolution parser
          const fileText = await file.text();
          const dissResult = parseDissolutionData(fileText);
          if (dissResult.success) {
            return dissResult;
          }
          
          // Finally try standard particle parser
          const partResult = parseParticleData(fileText);
          if (partResult.success) {
            return partResult;
          }
          
          // If all fail, check for specific error patterns to provide better guidance
          if (dissResult.error?.message?.includes("No 'Vessel' columns")) {
            return {
              success: false,
              error: {
                message: "This doesn't appear to be a dissolution file",
                details: "The file is missing vessel columns. Trying to parse as a particle size file also failed. Please check the file format."
              }
            };
          }
          
          // If both fail, return the more detailed error
          return dissResult.error?.details.length > (partResult.error?.details.length || 0) 
            ? dissResult 
            : partResult;
        } catch (error: any) {
          return {
            success: false,
            error: {
              message: "All parsing methods failed",
              details: error.toString()
            }
          };
        }
      }
    } catch (error: any) {
      logger.error(`Error parsing ${file.name}:`, error);
      return {
        success: false,
        error: {
          message: error.message || "Unknown parsing error",
          details: error.toString()
        }
      };
    }
  };
  
  const uploadFiles = async (files: File[], projectId: string) => {
    if (!projectId) {
      toast.error("Please select a project before uploading");
      return;
    }
    
    setIsUploading(true);
    setParseErrors([]);
    
    // Create job entries for each file
    const jobPromises = Array.from(files).map(file => createUploadJob(file));
    const newJobs = await Promise.all(jobPromises);
    
    setJobs(prev => [...prev, ...newJobs]);
    
    // Process each file one by one (simulating a queue)
    for (let i = 0; i < newJobs.length; i++) {
      const job = newJobs[i];
      const file = files[i];
      
      // Update job status to processing
      setJobs(prev => 
        prev.map(j => 
          j.id === job.id 
            ? { ...j, status: "processing" as const } 
            : j
        )
      );
      
      try {
        // Simulate file upload process with progress updates
        await simulateFileUpload(job.id);
        
        // Try to parse the file
        const parseResult = await parseFile(file, job.fileType);
        
        if (parseResult.success) {
          // Update job status to completed with the parsed data
          setJobs(prev => 
            prev.map(j => 
              j.id === job.id 
                ? { 
                    ...j, 
                    status: "completed" as const, 
                    progress: 100,
                    parsedData: parseResult.data
                  } 
                : j
            )
          );
          
          logger.log(`Successfully parsed ${file.name}, found ${parseResult.data?.length || 0} data points`);
        } else {
          // Handle parse error
          const errorDetails: ParseError = {
            fileName: file.name,
            message: parseResult.error?.message || "Unknown parsing error",
            details: parseResult.error?.details || "No details available",
            line: parseResult.error?.line,
            raw: parseResult.error?.raw
          };
          
          setParseErrors(prev => [...prev, errorDetails]);
          
          // Update job status to failed
          setJobs(prev => 
            prev.map(j => 
              j.id === job.id 
                ? { 
                    ...j, 
                    status: "failed" as const, 
                    error: parseResult.error?.message || "Parsing failed"
                  } 
                : j
            )
          );
          
          // Show error toast with button to show details
          toast.error(`Failed to parse ${file.name}`, {
            description: "Click 'View Details' to see more information and report this issue.",
            action: {
              label: "View Details",
              onClick: () => setCurrentError(errorDetails)
            },
            duration: 10000,
          });
        }
      } catch (error) {
        logger.error(`Error processing ${file.name}:`, error);
        // Simulate occasional failures
        setJobs(prev => 
          prev.map(j => 
            j.id === job.id 
              ? { 
                  ...j, 
                  status: "failed" as const, 
                  error: "An error occurred during processing" 
                } 
              : j
          )
        );
      }
    }
    
    setIsUploading(false);
    toast.success(`Processed ${files.length} files`);
  };
  
  // Simulate a file upload with progress updates
  const simulateFileUpload = async (jobId: string) => {
    const totalSteps = 10;
    const successProbability = 0.9; // 90% chance of success
    
    // Simulate random upload failures
    if (Math.random() > successProbability) {
      await new Promise(resolve => setTimeout(resolve, 500));
      throw new Error("Upload failed");
    }
    
    for (let step = 1; step <= totalSteps; step++) {
      // Update progress
      const progress = Math.floor((step / totalSteps) * 100);
      
      setJobs(prev => 
        prev.map(job => 
          job.id === jobId 
            ? { ...job, progress } 
            : job
        )
      );
      
      // Random delay between 200ms and 500ms
      const delay = Math.floor(Math.random() * 300) + 200;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  };
  
  // Clear completed jobs
  const clearCompletedJobs = () => {
    setJobs(prev => prev.filter(job => 
      job.status !== "completed" && job.status !== "failed"
    ));
  };
  
  // Clear all jobs
  const clearAllJobs = () => {
    setJobs([]);
  };
  
  return {
    jobs,
    isUploading,
    uploadFiles,
    clearCompletedJobs,
    clearAllJobs,
    parseErrors,
    currentError,
    setCurrentError
  };
}

export default useFileUpload;

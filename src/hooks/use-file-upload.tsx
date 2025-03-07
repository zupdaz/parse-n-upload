
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
  const detectFileType = async (file: File): Promise<"dissolution" | "particle" | undefined> => {
    try {
      // Read first few lines of the file
      const chunk = await file.slice(0, 500).text();
      const firstLines = chunk.split('\n').slice(0, 10).join(' ').toLowerCase();
      
      // Look for keywords to identify file type
      if (firstLines.includes('vessel') || firstLines.includes('time point')) {
        return "dissolution";
      } else if (firstLines.includes('batch') || firstLines.includes('particle') || 
                 firstLines.includes('d10') || firstLines.includes('d50') || 
                 firstLines.includes('d90') || firstLines.includes('file') && firstLines.includes('comment 1')) {
        return "particle";
      }
      
      // If can't detect from content, make a guess based on name
      if (file.name.toLowerCase().includes('diss')) {
        return "dissolution";
      } else if (file.name.toLowerCase().includes('part') || file.name.toLowerCase().includes('size')) {
        return "particle";
      }
      
      // Default fallback
      return Math.random() > 0.5 ? "dissolution" : "particle";
    } catch (error) {
      console.error("Error detecting file type:", error);
      return Math.random() > 0.5 ? "dissolution" : "particle";
    }
  };
  
  const isMastersizeFormat = async (file: File): Promise<boolean> => {
    try {
      const chunk = await file.slice(0, 2000).text();
      return chunk.includes('Comment 1') && chunk.includes('Comment 2') && 
             (chunk.includes('Size class') || chunk.includes('x(Q3='));
    } catch (error) {
      return false;
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
  
  const parseFile = async (file: File, fileType: "dissolution" | "particle" | undefined): Promise<ParseResult<any>> => {
    try {
      if (fileType === "dissolution") {
        return parseDissolutionData(await file.text());
      } else if (fileType === "particle") {
        // Check if this is a Mastersize format file that needs the Python parser
        const isMastersize = await isMastersizeFormat(file);
        
        if (isMastersize) {
          // Use the Python parser service for Mastersize format
          const result = await parseParticleFile(file);
          
          if (result.success) {
            return {
              success: true,
              data: result.data
            };
          } else {
            return {
              success: false,
              error: result.error
            };
          }
        } else {
          // Use the standard JS parser for other particle size formats
          return parseParticleData(await file.text());
        }
      } else {
        // Try both parsers if type is not determined
        const dissResult = parseDissolutionData(await file.text());
        if (dissResult.success) {
          return dissResult;
        }
        
        const partResult = parseParticleData(await file.text());
        if (partResult.success) {
          return partResult;
        }
        
        // If both fail, return the more detailed error
        return dissResult.error?.details.length > (partResult.error?.details.length || 0) 
          ? dissResult 
          : partResult;
      }
    } catch (error: any) {
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
          // Update job status to completed
          setJobs(prev => 
            prev.map(j => 
              j.id === job.id 
                ? { ...j, status: "completed" as const, progress: 100 } 
                : j
            )
          );
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


import { useState, useEffect } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { UploadJob } from "@/components/UploadProgress";
import { parseDissolutionData, parseParticleData, ParseResult } from "@/utils/fileParsers";

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
  
  const detectFileType = async (file: File): Promise<"dissolution" | "particle" | undefined> => {
    try {
      const chunk = await file.slice(0, 1500).text();
      const lines = chunk.split('\n').slice(0, 10);
      const header = lines[0].toLowerCase();
      
      // Check for Mastersizer format (tab-delimited with specific column structure)
      if (chunk.includes('\t') && (chunk.includes('Comment 1') || chunk.includes('Comment 2'))) {
        return "particle";
      }
      
      const particleSizePatterns = [
        'd10', 'd50', 'd90', 'd(0.1)', 'd(0.5)', 'd(0.9)',
        'd[v,0.1]', 'd[v,0.5]', 'd[v,0.9]',
        'span', 'surface area', 'specific surface',
        'median', 'distribution', 'particle size',
        'mastersizer', 'malvern', 'method_short', 'intermediate_form'
      ];
      
      const dissolutionPatterns = [
        'vessel', 'time point', 'timepoint', 'dissolution',
        'rpm', 'paddle', 'basket', 'usp apparatus'
      ];
      
      for (const pattern of particleSizePatterns) {
        if (header.includes(pattern)) {
          return "particle";
        }
      }
      
      for (const pattern of dissolutionPatterns) {
        if (header.includes(pattern)) {
          return "dissolution";
        }
      }
      
      // Look for blank rows followed by specific tables (Mastersizer structure)
      let blankRowCount = 0;
      for (let i = 0; i < lines.length && i < 10; i++) {
        if (!lines[i].trim()) {
          blankRowCount++;
          if (blankRowCount >= 2) {
            return "particle"; // Likely a Mastersizer file
          }
        }
      }
      
      const potentialTimePoints = lines.slice(1, 5).filter(line => {
        const cells = line.split(',');
        return cells.length > 2 && !isNaN(parseFloat(cells[0]));
      });
      
      if (potentialTimePoints.length >= 2) {
        return "dissolution";
      }
      
      if (file.name.toLowerCase().includes('diss')) {
        return "dissolution";
      } else if (
        file.name.toLowerCase().includes('part') || 
        file.name.toLowerCase().includes('size') ||
        file.name.toLowerCase().includes('psd') ||
        file.name.toLowerCase().includes('master')
      ) {
        return "particle";
      }
      
      return undefined;
    } catch (error) {
      console.error("Error detecting file type:", error);
      return undefined;
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
      const content = await file.text();
      
      if (fileType === "dissolution") {
        return parseDissolutionData(content);
      } else if (fileType === "particle") {
        return parseParticleData(content);
      } else {
        const dissResult = parseDissolutionData(content);
        if (dissResult.success) {
          return dissResult;
        }
        
        const partResult = parseParticleData(content);
        if (partResult.success) {
          return partResult;
        }
        
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
    
    const jobPromises = Array.from(files).map(file => createUploadJob(file));
    const newJobs = await Promise.all(jobPromises);
    
    setJobs(prev => [...prev, ...newJobs]);
    
    for (let i = 0; i < newJobs.length; i++) {
      const job = newJobs[i];
      const file = files[i];
      
      setJobs(prev => 
        prev.map(j => 
          j.id === job.id 
            ? { ...j, status: "processing" as const } 
            : j
        )
      );
      
      try {
        await simulateFileUpload(job.id);
        
        const parseResult = await parseFile(file, job.fileType);
        
        if (parseResult.success) {
          setJobs(prev => 
            prev.map(j => 
              j.id === job.id 
                ? { ...j, status: "completed" as const, progress: 100 } 
                : j
            )
          );
        } else {
          const errorDetails: ParseError = {
            fileName: file.name,
            message: parseResult.error?.message || "Unknown parsing error",
            details: parseResult.error?.details || "No details available",
            line: parseResult.error?.line,
            raw: parseResult.error?.raw
          };
          
          setParseErrors(prev => [...prev, errorDetails]);
          
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
  
  const simulateFileUpload = async (jobId: string) => {
    const totalSteps = 10;
    const successProbability = 0.9;
    
    if (Math.random() > successProbability) {
      await new Promise(resolve => setTimeout(resolve, 500));
      throw new Error("Upload failed");
    }
    
    for (let step = 1; step <= totalSteps; step++) {
      const progress = Math.floor((step / totalSteps) * 100);
      
      setJobs(prev => 
        prev.map(job => 
          job.id === jobId 
            ? { ...job, progress } 
            : job
        )
      );
      
      const delay = Math.floor(Math.random() * 300) + 200;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  };
  
  const clearCompletedJobs = () => {
    setJobs(prev => prev.filter(job => 
      job.status !== "completed" && job.status !== "failed"
    ));
  };
  
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

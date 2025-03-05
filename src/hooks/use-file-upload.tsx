
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { UploadJob } from "@/components/UploadProgress";
import { 
  parseFileContent, 
  DissolutionResult, 
  ParticleSizeResult 
} from "@/utils/fileParsers";

export interface ParsedResult {
  id: string;
  fileName: string;
  fileType: "dissolution" | "particle";
  data: DissolutionResult | ParticleSizeResult;
}

export function useFileUpload() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedResults, setParsedResults] = useState<ParsedResult[]>([]);
  
  // More accurate file type detection based on content
  const detectFileType = async (file: File): Promise<"dissolution" | "particle" | undefined> => {
    try {
      // Read first few lines of the file
      const chunk = await file.slice(0, 500).text();
      const firstLines = chunk.split('\n').slice(0, 2).join(' ').toLowerCase();
      
      // Look for keywords to identify file type
      if (firstLines.includes('vessel') || firstLines.includes('time point')) {
        return "dissolution";
      } else if (firstLines.includes('batch') || firstLines.includes('particle') || 
                 firstLines.includes('d10') || firstLines.includes('d50') || 
                 firstLines.includes('d90')) {
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
  
  const uploadFiles = async (files: File[], projectId: string) => {
    if (!projectId) {
      toast.error("Please select a project before uploading");
      return;
    }
    
    setIsUploading(true);
    
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
        
        // Actual file parsing
        const result = await parseFileContent(file);
        
        if (result && job.fileType) {
          // Store the parsed result
          setParsedResults(prev => [
            ...prev, 
            { 
              id: job.id, 
              fileName: file.name, 
              fileType: job.fileType as "dissolution" | "particle",
              data: result 
            }
          ]);
        }
        
        // Update job status to completed
        setJobs(prev => 
          prev.map(j => 
            j.id === job.id 
              ? { ...j, status: "completed" as const, progress: 100 } 
              : j
          )
        );
      } catch (error) {
        // Handle parsing failures
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
    const completedJobIds = jobs
      .filter(job => job.status === "completed" || job.status === "failed")
      .map(job => job.id);
    
    setJobs(prev => prev.filter(job => 
      job.status !== "completed" && job.status !== "failed"
    ));
    
    // Also clear the parsed results for completed jobs
    setParsedResults(prev => 
      prev.filter(result => !completedJobIds.includes(result.id))
    );
  };
  
  // Clear all jobs
  const clearAllJobs = () => {
    setJobs([]);
    setParsedResults([]);
  };
  
  return {
    jobs,
    parsedResults,
    isUploading,
    uploadFiles,
    clearCompletedJobs,
    clearAllJobs
  };
}

export default useFileUpload;

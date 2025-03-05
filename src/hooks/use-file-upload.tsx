
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { UploadJob } from "@/components/UploadProgress";

export function useFileUpload() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Simulate file type detection
  const detectFileType = (file: File): "dissolution" | "particle" | undefined => {
    return Math.random() > 0.5 ? "dissolution" : "particle";
  };
  
  const uploadFiles = async (files: File[], projectId: string) => {
    if (!projectId) {
      toast.error("Please select a project before uploading");
      return;
    }
    
    setIsUploading(true);
    
    // Create job entries for each file
    const newJobs: UploadJob[] = files.map(file => ({
      id: uuidv4(),
      fileName: file.name,
      status: "queued",
      progress: 0,
      fileType: detectFileType(file),
      createdAt: new Date()
    }));
    
    setJobs(prev => [...prev, ...newJobs]);
    
    // Process each file one by one (simulating a queue)
    for (let i = 0; i < newJobs.length; i++) {
      const job = newJobs[i];
      
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
        
        // Update job status to completed
        setJobs(prev => 
          prev.map(j => 
            j.id === job.id 
              ? { ...j, status: "completed" as const, progress: 100 } 
              : j
          )
        );
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
    clearAllJobs
  };
}

export default useFileUpload;

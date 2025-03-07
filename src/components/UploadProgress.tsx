
import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  FileType
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface UploadJob {
  id: string;
  fileName: string;
  status: JobStatus;
  progress: number;
  fileType?: "dissolution" | "particle";
  error?: string;
  createdAt: Date;
}

interface UploadProgressProps {
  jobs: UploadJob[];
  onComplete?: () => void;
}

export function UploadProgress({ jobs, onComplete }: UploadProgressProps) {
  const [completedCount, setCompletedCount] = useState(0);
  
  useEffect(() => {
    const completed = jobs.filter(
      job => job.status === "completed" || job.status === "failed"
    ).length;
    
    setCompletedCount(completed);
    
    if (completed === jobs.length && jobs.length > 0 && onComplete) {
      onComplete();
    }
  }, [jobs, onComplete]);

  if (jobs.length === 0) {
    return null;
  }

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case "queued":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getFileTypeIcon = (type?: "dissolution" | "particle") => {
    return <FileType className="h-4 w-4 mr-2 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Upload Progress</h3>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{jobs.length} completed
        </span>
      </div>
      
      <Progress value={(completedCount / jobs.length) * 100} className="h-2" />
      
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {jobs.map((job) => (
          <div
            key={job.id}
            className={cn(
              "p-3 rounded-md border text-sm transition-all animate-slide-up",
              job.status === "failed" ? "border-destructive/30 bg-destructive/5" : "border-border"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 overflow-hidden mr-2">
                {getFileTypeIcon(job.fileType)}
                <span className="font-medium truncate">{job.fileName}</span>
              </div>
              <div className="flex items-center space-x-1 flex-shrink-0">
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  job.status === "queued" && "bg-muted text-muted-foreground",
                  job.status === "processing" && "bg-primary/10 text-primary",
                  job.status === "completed" && "bg-green-500/10 text-green-500",
                  job.status === "failed" && "bg-destructive/10 text-destructive"
                )}>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>
                {getStatusIcon(job.status)}
              </div>
            </div>
            
            {job.status === "processing" && (
              <Progress 
                value={job.progress} 
                className="h-1 mt-1" 
              />
            )}
            
            {job.status === "failed" && job.error && (
              <p className="text-xs text-destructive mt-1">
                {job.error}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

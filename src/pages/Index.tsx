
import { useState, useEffect } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { ProjectSelector } from "@/components/ProjectSelector";
import { FileUploader } from "@/components/FileUploader";
import { UploadProgress } from "@/components/UploadProgress";
import { SampleFilesDownloader } from "@/components/SampleFilesDownloader";
import { ErrorReportDialog } from "@/components/ErrorReportDialog";
import useFileUpload from "@/hooks/use-file-upload";
import { checkElectronEnvironment } from "@/utils/electronCheck";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Trash2,
  Check,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { 
    jobs, 
    isUploading, 
    uploadFiles, 
    clearCompletedJobs, 
    clearAllJobs,
    currentError,
    setCurrentError
  } = useFileUpload();

  useEffect(() => {
    // Check if we're running in electron environment
    checkElectronEnvironment();
  }, []);

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    toast.success("Project selected", {
      description: `You've selected project ID: ${projectId}`,
    });
  };

  const handleFilesSelected = (files: File[]) => {
    if (!selectedProjectId) {
      toast.error("Please select a project first");
      return;
    }
    
    uploadFiles(files, selectedProjectId);
  };

  const handleUploadComplete = () => {
    if (jobs.some(job => job.status === "completed")) {
      toast.success("Upload process completed", {
        description: "All files have been processed successfully.",
      });
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col space-y-8 animate-fade-in">
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">File Parser</h1>
              <p className="text-muted-foreground mt-1">
                Upload and process files for analysis
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <SampleFilesDownloader />
              {jobs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCompletedJobs}
                  className="h-9"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Clear Completed
                </Button>
              )}
              {jobs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllJobs}
                  className="h-9"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              )}
            </div>
          </div>
          <Separator />
        </section>

        <div className="grid gap-6 md:grid-cols-12">
          <Card className="md:col-span-5 lg:col-span-4">
            <CardHeader>
              <CardTitle>Project Selection</CardTitle>
              <CardDescription>
                Choose a project to upload files to
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectSelector onProjectSelect={handleProjectSelect} />
            </CardContent>
          </Card>
          
          <Card className="md:col-span-7 lg:col-span-8">
            <CardHeader>
              <CardTitle>File Upload</CardTitle>
              <CardDescription>
                Upload CSV, XLSX, or XLSM files for processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FileUploader
                projectId={selectedProjectId}
                onFilesSelected={handleFilesSelected}
                disabled={isUploading}
              />
              
              {isUploading && (
                <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground animate-pulse">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing files...</span>
                </div>
              )}
              
              {jobs.length > 0 && (
                <>
                  <Separator />
                  <UploadProgress
                    jobs={jobs}
                    onComplete={handleUploadComplete}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Error Report Dialog */}
        <ErrorReportDialog 
          open={!!currentError} 
          onOpenChange={(open) => {
            if (!open) setCurrentError(null);
          }}
          errorDetails={currentError} 
        />
      </div>
    </AppLayout>
  );
};

export default Index;

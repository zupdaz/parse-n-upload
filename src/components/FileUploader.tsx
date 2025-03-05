
import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud, File, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FileUploaderProps {
  projectId: string | null;
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function FileUploader({ 
  projectId, 
  onFilesSelected, 
  disabled = false 
}: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFiles = (files: FileList | null): File[] => {
    if (!files) return [];
    
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (extension === 'csv' || extension === 'xlsx' || extension === 'xlsm') {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }
    
    if (invalidFiles.length > 0) {
      toast.error("Invalid file format", {
        description: `Only CSV, XLSX, and XLSM files are supported. Invalid files: ${invalidFiles.join(', ')}`
      });
    }
    
    return validFiles;
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (!projectId) {
      toast.error("Please select a project first");
      return;
    }
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newValidFiles = validateFiles(e.dataTransfer.files);
      if (newValidFiles.length > 0) {
        const updatedFiles = [...selectedFiles, ...newValidFiles];
        setSelectedFiles(updatedFiles);
        toast.success(`${newValidFiles.length} files added`);
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!projectId) {
      toast.error("Please select a project first");
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    const newValidFiles = validateFiles(e.target.files);
    if (newValidFiles.length > 0) {
      const updatedFiles = [...selectedFiles, ...newValidFiles];
      setSelectedFiles(updatedFiles);
      toast.success(`${newValidFiles.length} files added`);
    }
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
  };

  const handleSubmit = () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select files to upload");
      return;
    }
    
    onFilesSelected(selectedFiles);
    setSelectedFiles([]);
  };

  return (
    <div className="w-full space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        id="file-upload"
        multiple
        onChange={handleChange}
        accept=".csv,.xlsx,.xlsm"
        className="hidden"
        disabled={disabled || !projectId}
      />
      
      <div
        className={cn(
          "upload-area flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg p-6 transition-all",
          dragActive ? "border-primary/50 bg-primary/5" : "border-border",
          !projectId && "opacity-70 cursor-not-allowed",
          "hover:border-primary/30 hover:bg-primary/5"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
          <UploadCloud className="w-8 h-8 mb-3 text-muted-foreground" />
          <p className="mb-2 text-sm text-muted-foreground">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">
            CSV, XLSX, XLSM (Max size: 50MB per file)
          </p>
        </div>
        <Button 
          type="button" 
          variant="secondary" 
          className="mt-2" 
          onClick={handleButtonClick}
          disabled={disabled || !projectId}
        >
          Select Files
        </Button>
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <div className="text-sm font-medium">Selected Files ({selectedFiles.length})</div>
          <div className="max-h-48 overflow-y-auto space-y-2 rounded-md border border-border p-2">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center justify-between bg-secondary rounded-md p-2 text-sm animate-slide-up">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button 
              onClick={handleSubmit} 
              disabled={disabled}
              className="transition-all"
            >
              Upload Files
            </Button>
          </div>
        </div>
      )}
      
      {!projectId && (
        <div className="flex items-center justify-center p-3 text-sm text-muted-foreground bg-muted rounded-md animate-fade-in">
          <AlertCircle className="h-4 w-4 mr-2" />
          Please select a project before uploading files
        </div>
      )}
    </div>
  );
}

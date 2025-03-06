
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Mail, Check } from "lucide-react";
import { toast } from "sonner";

interface ErrorReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorDetails: {
    fileName: string;
    message: string;
    details: string;
    line?: number;
    raw?: string;
  } | null;
}

export function ErrorReportDialog({
  open,
  onOpenChange,
  errorDetails
}: ErrorReportDialogProps) {
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  if (!errorDetails) return null;
  
  const handleSendReport = () => {
    setIsSending(true);
    
    // Simulate sending email
    setTimeout(() => {
      setIsSending(false);
      onOpenChange(false);
      
      toast.success("Error report sent", {
        description: "Your report has been sent to the development team.",
        duration: 5000,
      });
      
      setAdditionalInfo("");
    }, 1500);
    
    // In a real implementation, you would send this data to your backend
    const reportData = {
      to: "dummymail@gmail.com",
      subject: `File Parsing Error: ${errorDetails.fileName}`,
      body: `
File: ${errorDetails.fileName}
Error: ${errorDetails.message}
${errorDetails.line ? `Line: ${errorDetails.line}` : ''}

Details:
${errorDetails.details}

${errorDetails.raw ? `Raw data:
${errorDetails.raw}` : ''}

Additional information:
${additionalInfo || 'No additional information provided.'}
      `.trim()
    };
    
    console.log("Sending error report:", reportData);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
            File Parsing Error
          </DialogTitle>
          <DialogDescription>
            The system encountered an error while parsing "{errorDetails.fileName}".
            You can report this issue to our development team.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 my-2">
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium text-destructive">{errorDetails.message}</p>
            {errorDetails.line && (
              <p className="text-muted-foreground mt-1">Line: {errorDetails.line}</p>
            )}
            <p className="mt-2 whitespace-pre-wrap break-words">{errorDetails.details}</p>
          </div>
          
          <Textarea
            placeholder="Any additional information about this file or the error..."
            className="min-h-[80px]"
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSendReport} disabled={isSending}>
            {isSending ? (
              <>Sending...</>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

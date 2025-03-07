
import { toast } from "sonner";

export interface ParticleParsingResult {
  success: boolean;
  data?: any[];
  error?: {
    message: string;
    details: string;
    line?: number;
    raw?: string;
  };
}

export const parseParticleFile = async (file: File): Promise<ParticleParsingResult> => {
  try {
    console.log(`Sending file ${file.name} for particle parsing via electron IPC`);
    
    // Create a form data object to pass to the main process
    const fileBuffer = await file.arrayBuffer();
    
    // Check if we're running in Electron environment
    if (window.electron) {
      console.log("Using electron IPC to parse particle file");
      
      try {
        // Save the file to a temporary location and get the path
        const tempFilePath = await window.electron.saveTempFile(file.name, new Uint8Array(fileBuffer));
        console.log(`Temporary file saved at: ${tempFilePath}`);
        
        // Call the Python parser through electron
        const result = await window.electron.runPythonParser(tempFilePath);
        console.log(`Received parser result for ${file.name}: success=${result.success}`);
        
        return result;
      } catch (error) {
        console.error("Error in electron IPC parsing:", error);
        return {
          success: false,
          error: {
            message: 'Failed to parse file using electron',
            details: error instanceof Error ? error.message : String(error)
          }
        };
      }
    } else {
      // Fallback to web worker approach
      console.log("Electron not available, using web worker fallback");
      
      // Create a FormData object for XHR
      const formData = new FormData();
      formData.append('file', file);
      
      // Display an error message with instructions
      toast.error("Parser execution failed", {
        description: "This application requires Electron environment to parse particle size files. Please use the desktop version.",
        duration: 6000
      });
      
      return {
        success: false,
        error: {
          message: 'Particle size parser requires desktop app',
          details: 'To parse particle size files, please use the desktop application which includes the Python parser. Web version has limited functionality.'
        }
      };
    }
  } catch (error) {
    console.error("Error in parseParticleFile:", error);
    
    // More detailed error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: {
        message: 'Failed to parse particle file',
        details: `Error: ${errorMessage}`
      }
    };
  }
};

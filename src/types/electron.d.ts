
interface ElectronAPI {
  saveTempFile: (fileName: string, data: Uint8Array) => Promise<string>;
  runPythonParser: (filePath: string) => Promise<{
    success: boolean;
    data?: any[];
    error?: {
      message: string;
      details: string;
      line?: number;
      raw?: string;
    };
  }>;
}

interface Window {
  electron?: ElectronAPI;
}

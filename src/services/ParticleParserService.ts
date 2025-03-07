
import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api';

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
    const formData = new FormData();
    formData.append('file', file);

    console.log(`Sending file ${file.name} to particle parser at ${API_BASE_URL}/parse-particle-size`);
    
    const response = await axios.post(
      `${API_BASE_URL}/parse-particle-size`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // Increase timeout to 30 seconds for larger files
      }
    );

    console.log(`Received response from particle parser for ${file.name}:`, response.data.success);
    return response.data;
  } catch (error) {
    console.error("Error in parseParticleFile:", error);
    
    if (axios.isAxiosError(error) && error.response) {
      return error.response.data as ParticleParsingResult;
    }
    
    // More detailed error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: {
        message: 'Failed to connect to parser service',
        details: `Connection error: ${errorMessage}. Make sure the parser server is running at ${API_BASE_URL}.`
      }
    };
  }
};

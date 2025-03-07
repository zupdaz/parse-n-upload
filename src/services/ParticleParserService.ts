
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

    const response = await axios.post(
      `${API_BASE_URL}/parse-particle-size`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return error.response.data as ParticleParsingResult;
    }
    
    return {
      success: false,
      error: {
        message: 'Failed to connect to parser service',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    };
  }
};

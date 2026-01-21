import { useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';

interface ExportFilters {
  [key: string]: any;
}

interface UseExportsReturn {
  isLoading: boolean;
  error: string | null;
  exportToExcel: (filters?: ExportFilters) => Promise<void>;
}


export const useExports = (): UseExportsReturn => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);


  const generateFileName = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `showcase_${year}${month}${day}${hours}${minutes}${seconds}.xlsx`;
  };


  const downloadFile = (blob: Blob, fileName: string): void => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };


  const exportToExcel = useCallback(async (filters?: ExportFilters): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        '/api/projects/export',
        filters || {},
        {
          responseType: 'blob',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const contentType = response.headers['content-type'];
      
      if (contentType && contentType.includes('application/json')) {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.message || 'Error exporting data');
      }

      const fileName = generateFileName();
      downloadFile(response.data, fileName);
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      
      let errorMessage = 'Error exporting data';
      
      if (axiosError.response?.data) {
        if (axiosError.response.data instanceof Blob) {
          try {
            const text = await axiosError.response.data.text();
            const errorData = JSON.parse(text);
            errorMessage = errorData.message || errorMessage;
          } catch {
                errorMessage = 'An error occurred while processing the server response';
            }
        } else if (axiosError.response.data.message) {
          errorMessage = axiosError.response.data.message;
        }
      } else if (axiosError.message) {
        errorMessage = axiosError.message;
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    exportToExcel,
  };
};


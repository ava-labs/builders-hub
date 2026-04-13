import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';

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
      const response = await apiFetch<Response>('/api/projects/export', {
        method: 'POST',
        body: filters || {},
        raw: true,
      });

      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error exporting data');
      }

      const blob = await response.blob();
      const fileName = generateFileName();
      downloadFile(blob, fileName);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error exporting data';
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


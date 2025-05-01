import { useState, useEffect, useRef } from 'react';
import { useImageValidation } from './useImageValidation';
import { ALLOWED_FILE_TYPES } from '@/constants/upload';

interface UploadState {
  status: 'initial' | 'uploading' | 'success' | 'error';
  source: 'drag' | 'url' | null;
  fileInfo?: {
    name: string;
    size: number;
    url: string;
    type?: string;
  };
  error?: {
    message: string;
    subMessage?: string;
  };
}

interface UseUploadStateProps {
  onFileSelect?: (file: File | null) => void;
  onUrlUpload?: (url: string) => void;
}

export const useUploadState = ({ onFileSelect, onUrlUpload }: UseUploadStateProps) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'initial',
    source: null,
  });
  const [fileUrl, setFileUrl] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { validateImage, validateUrl } = useImageValidation();

  const handleUrlUpload = async () => {
    if (!validateUrl(fileUrl)) {
      setUploadState({
        status: 'error',
        source: 'url',
        error: {
          message: 'Invalid URL.',
          subMessage: 'Make sure the link points to a valid image.'
        }
      });
      return;
    }

    abortControllerRef.current = new AbortController();

    setUploadState({
      status: 'uploading',
      source: 'url',
    });

    try {
      const response = await fetch(fileUrl, {
        signal: abortControllerRef.current.signal
      });
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      if (!ALLOWED_FILE_TYPES.includes(blob.type)) {
        throw new Error('Invalid file type');
      }
      
      const file = new File([blob], fileUrl.split('/').pop() || 'image.jpg', { type: blob.type });
      const objectUrl = URL.createObjectURL(blob);
      
      const validation = await validateImage(file);
      if (!validation.valid) {
        URL.revokeObjectURL(objectUrl);
        setUploadState({
          status: 'error',
          source: 'url',
          error: validation.error
        });
        return;
      }

      if (onFileSelect) {
        onFileSelect(file);
      }

      setUploadState({
        status: 'success',
        source: 'url',
        fileInfo: {
          name: file.name,
          size: file.size,
          url: objectUrl,
          type: file.type
        }
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setUploadState({
          status: 'initial',
          source: null
        });
        return;
      }

      setUploadState({
        status: 'error',
        source: 'url',
        error: {
          message: 'Invalid URL.',
          subMessage: 'Make sure the link points to a valid image.'
        }
      });
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleFileSelect = async (file: File | null) => {
    if (!file) {
      setUploadState({
        status: 'initial',
        source: null
      });
      return;
    }

    const validation = await validateImage(file);
    if (!validation.valid) {
      setUploadState({
        status: 'error',
        source: 'drag',
        error: validation.error
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setUploadState({
      status: 'uploading',
      source: 'drag',
      fileInfo: {
        name: file.name,
        size: file.size,
        url: objectUrl,
        type: file.type
      }
    });

    const timeoutId = setTimeout(() => {
      setUploadState(prev => ({
        ...prev,
        status: 'success'
      }));
      if (onFileSelect) onFileSelect(file);
    }, 2000);

    abortControllerRef.current = {
      abort: () => clearTimeout(timeoutId)
    } as AbortController;
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (uploadState.fileInfo?.url) {
      URL.revokeObjectURL(uploadState.fileInfo.url);
    }

    if (onFileSelect) {
      onFileSelect(null);
    }

    setUploadState({
      status: 'initial',
      source: null,
    });
    setFileUrl('');
  };

  const handleDone = () => {
    setIsReplacing(false);
    return true;
  };

  const handleDelete = () => {
    if (uploadState.fileInfo?.url) {
      URL.revokeObjectURL(uploadState.fileInfo.url);
    }
    setUploadState({
      status: 'initial',
      source: null
    });
    setFileUrl('');
    if (onFileSelect) {
      onFileSelect(null);
    }
  };

  const handleReplace = () => {
    setIsReplacing(true);
    setUploadState({
      status: 'initial',
      source: null
    });
    setFileUrl('');
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (uploadState.fileInfo?.url) {
        URL.revokeObjectURL(uploadState.fileInfo.url);
      }
    };
  }, []);

  return {
    uploadState,
    fileUrl,
    isReplacing,
    setFileUrl,
    handleUrlUpload,
    handleFileSelect,
    handleCancel,
    handleDone,
    handleDelete,
    handleReplace,
    setIsReplacing,
    setUploadState
  };
}; 
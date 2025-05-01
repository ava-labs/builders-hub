import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Modal from '@/components/ui/Modal';
import { BadgeCheck } from 'lucide-react';
import { useUploadState } from '@/hooks/useUploadState';
import { FilePreview } from './FilePreview';
import { UploadSuccessState } from './UploadSuccessState';
import { UploadingState } from './UploadingState';
import { ErrorState } from './ErrorState';
import { InitialUploadState } from './InitialUploadState';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml'];
const MAX_IMAGE_DIMENSION = 2048; // pixels

interface UploadModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onFileSelect?: (file: File | null) => void;
  onUrlUpload?: (url: string) => void;
  onDelete?: () => void;
}

const validateImageDimensions = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve(
        img.width <= MAX_IMAGE_DIMENSION && img.height <= MAX_IMAGE_DIMENSION
      );
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
};

const validateMimeType = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    return contentType && ALLOWED_FILE_TYPES.includes(contentType)
      ? contentType
      : null;
  } catch {
    return null;
  }
};

const downloadAndValidateImage = async (
  url: string
): Promise<{ valid: boolean; blob?: Blob; error?: string }> => {
  try {
    // Validar URL
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        valid: false,
        error: 'Invalid URL protocol. Only HTTP and HTTPS are allowed.',
      };
    }

    const mimeType = await validateMimeType(url);
    if (!mimeType) {
      return {
        valid: false,
        error: 'Invalid file type. Only JPG, PNG and SVG are allowed.',
      };
    }

    const response = await fetch(url);
    if (!response.ok) {
      return { valid: false, error: 'Failed to download image.' };
    }

    const blob = await response.blob();

    if (blob.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'File size exceeds 1MB limit.' };
    }

    const imageUrl = URL.createObjectURL(blob);
    const validDimensions = await validateImageDimensions(imageUrl);
    URL.revokeObjectURL(imageUrl);

    if (!validDimensions) {
      return {
        valid: false,
        error: `Image dimensions must not exceed ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} pixels.`,
      };
    }

    return { valid: true, blob };
  } catch (error) {
    return { valid: false, error: 'Failed to process image.' };
  }
};

export default function UploadModal({
  isOpen,
  onOpenChange,
  onFileSelect,
  onUrlUpload,
  onDelete,
}: UploadModalProps) {
  const {
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
  } = useUploadState({ onFileSelect, onUrlUpload });

  useEffect(() => {
    if (!isOpen && !isReplacing) {
      setUploadState({
        status: 'initial',
        source: null,
      });
      setFileUrl('');
    }
  }, [isOpen, isReplacing]);

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const validateImage = async (file: File): Promise<{ valid: boolean; error?: { message: string; subMessage: string } }> => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: {
          message: 'Invalid format.',
          subMessage: 'Only PNG, JPG, and SVG are supported.'
        }
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: {
          message: 'The file is too large (Max: 1MB).',
          subMessage: 'Try compressing it.'
        }
      };
    }

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        if (img.width !== img.height) {
          resolve({
            valid: false,
            error: {
              message: 'The image is not square.',
              subMessage: 'Recommended size: 512 x 512px.'
            }
          });
        } else {
          resolve({ valid: true });
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          valid: false,
          error: {
            message: 'Invalid image.',
            subMessage: 'The file could not be loaded as an image.'
          }
        });
      };
      
      img.src = objectUrl;
    });
  };

  const renderContent = () => {
    switch (uploadState.status) {
      case 'uploading':
        return <UploadingState onCancel={handleCancel} />;
      case 'success':
        return <UploadSuccessState onClose={() => {
          if (handleDone()) {
            onOpenChange(false);
          }
        }} />;
      case 'error':
        return (
          <ErrorState 
            message={uploadState.error?.message || 'Error uploading image'} 
            subMessage={uploadState.error?.subMessage}
            onReplace={handleReplace}
          />
        );
      default:
        return <InitialUploadState onFileSelect={handleFileSelect} />;
    }
  };

  const renderFooter = () => {
    if (uploadState.fileInfo && uploadState.status !== 'error') {
      return (
        <div className="w-full">
          <p className="text-sm font-medium text-black dark:text-white mb-2">
            {uploadState.status === 'success' ? 'Upload Successful!' : 'Current Image'}
          </p>
          <FilePreview 
            {...uploadState.fileInfo} 
            onEdit={handleReplace}
            onDelete={handleDelete}
          />
        </div>
      );
    }

    if (uploadState.status !== 'uploading' && uploadState.status !== 'error') {
      return (
        <div className="w-full space-y-2">
          <p className="text-sm font-medium text-black dark:text-white">Upload from URL</p>
          <div className="flex items-center gap-2 p-4 bg-gray-100 dark:bg-zinc-800 rounded-md">
            <svg
              className="w-5 h-5 text-gray-500 dark:text-zinc-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <Input
              type="text"
              placeholder="Add file URL"
              className="border-none !bg-transparent text-black dark:text-white h-8 focus-visible:ring-0 focus-visible:ring-offset-0"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
            />
            <Button 
              className="bg-gray-900 dark:bg-black text-white hover:bg-gray-800 dark:hover:bg-zinc-800 rounded-md px-4 py-1"
              disabled={!fileUrl}
              onClick={handleUrlUpload}
            >
              Upload
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          if (isReplacing) {
            setIsReplacing(false);
            if (uploadState.fileInfo) {
              setUploadState(prev => ({
                ...prev,
                status: prev.status === 'error' ? 'error' : 'success'
              }));
            }
          } else {
            setUploadState({
              status: 'initial',
              source: null,
            });
            setFileUrl('');
          }
        }
        onOpenChange(open);
      }}
      title="Upload Profile Image or Avatar"
      description="Add the image here. Recommended size: 512 x 512px (square format)"
      content={renderContent()}
      footer={renderFooter()}
      className="bg-white dark:bg-zinc-900 text-black dark:text-white"
      contentClassName="py-4"
    />
  );
}

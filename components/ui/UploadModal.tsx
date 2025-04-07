import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Modal from '@/components/ui/Modal';
import { BadgeCheck } from 'lucide-react';

// Constantes de validación
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml'];
const MAX_IMAGE_DIMENSION = 2048; // píxeles

interface UploadModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onFileSelect?: (file: File | null) => void;
  onUrlUpload?: (url: string) => void;
}

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

// Función para validar dimensiones de imagen
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

// Función para validar el tipo MIME
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

// Función para descargar y validar la imagen
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

    // Validar tipo MIME
    const mimeType = await validateMimeType(url);
    if (!mimeType) {
      return {
        valid: false,
        error: 'Invalid file type. Only JPG, PNG and SVG are allowed.',
      };
    }

    // Descargar imagen
    const response = await fetch(url);
    if (!response.ok) {
      return { valid: false, error: 'Failed to download image.' };
    }

    const blob = await response.blob();

    // Validar tamaño
    if (blob.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'File size exceeds 1MB limit.' };
    }

    // Validar dimensiones
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

// File Preview Component
function FilePreview({ 
  name, 
  size, 
  url,
  onEdit,
  onDelete 
}: { 
  name: string;
  size: number;
  url: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + ' KB';
    const mb = kb / 1024;
    return mb.toFixed(1) + ' MB';
  };

  const truncateFileName = (name: string, maxLength = 20) => {
    if (name.length <= maxLength) return name;
    const ext = name.split('.').pop();
    const nameWithoutExt = name.slice(0, -(ext?.length || 0) - 1);
    return `${nameWithoutExt.slice(0, maxLength - 3)}...${ext}`;
  };

  return (
    <div className="bg-zinc-800 rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-zinc-700 rounded flex items-center justify-center overflow-hidden">
          <img src={url} alt={name} className="w-full h-full object-contain" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-white">{truncateFileName(name)}</span>
          <span className="text-xs text-zinc-400">{formatFileSize(size)}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-zinc-600"
          onClick={onEdit}
          title="Replace image"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-red-500/20 text-red-400 hover:text-red-500"
          onClick={onDelete}
          title="Remove image"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </Button>
      </div>
    </div>
  );
}

// Upload Success State
function UploadSuccessState({ onClose }: { onClose: () => void }) {
  return (
    <div className='flex flex-col items-center justify-center gap-3 border-2 border-red-500 rounded-lg p-8 text-center cursor-pointer bg-zinc-800 animate-in fade-in slide-in-from-bottom-4'>
      <div className='flex items-center justify-center'>
        <BadgeCheck size={36} className='text-red-500' />
      </div>
      <p className='text-white text-lg'>
        Success! Your image is now saved.
      </p>
      <Button 
        className='bg-white text-black hover:bg-zinc-100 border-none w-fit mx-auto'
        onClick={onClose}
      >
        Done
      </Button>
    </div>
  );
}

// Error State
function ErrorState({ 
  message,
  subMessage,
  onReplace
}: { 
  message: string;
  subMessage?: string;
  onReplace: () => void;
}) {
  return (
    <div className='flex flex-col items-center justify-center gap-3 border-2 border-red-500 rounded-lg p-8 text-center cursor-pointer bg-zinc-800 animate-in fade-in slide-in-from-bottom-4'>
      <div className='flex items-center justify-center'>
        <div className='w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center'>
          <svg className='w-6 h-6 text-red-500' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
          </svg>
        </div>
      </div>
      <div className='space-y-1'>
        <p className='text-red-500 text-lg'>{message}</p>
        {subMessage && (
          <p className='text-sm text-zinc-400'>{subMessage}</p>
        )}
      </div>
      <Button 
        className='w-fit'
        onClick={onReplace}
      >
        Replace
      </Button>
    </div>
  );
}

// Uploading State
function UploadingState({ onCancel }: { onCancel?: () => void }) {
  return (
    <div className='flex flex-col items-center justify-center gap-3 border-2 border-red-500 rounded-lg p-8 text-center cursor-pointer bg-zinc-800 animate-in fade-in slide-in-from-bottom-4'>
      <div className='w-full bg-zinc-400 rounded-full h-4'>
        <div className='bg-red-500 h-4 rounded-full w-3/4 animate-pulse'></div>
      </div>
      <p className='text-center text-zinc-400'>
        Uploading...
      </p>
      <Button
        className='w-fit'
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
}

// Initial Upload State
function InitialUploadState({
  onFileSelect,
}: {
  onFileSelect?: (file: File | null) => void;
}) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && onFileSelect) onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <div 
        className="border-2 border-dashed border-red-500 rounded-lg p-8 text-center cursor-pointer hover:bg-zinc-800/50"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          type="file"
          id="fileInput"
          className="hidden"
          accept="image/jpeg,image/png,image/svg+xml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onFileSelect) onFileSelect(file);
          }}
        />
        <label htmlFor="fileInput" className="flex flex-col items-center gap-3 cursor-pointer">
          <svg
            className="w-8 h-8 text-red-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          <div>
            <span className="text-zinc-400">Drag your file(s) or </span>
            <span className="text-red-500">browse</span>
          </div>
          <span className="text-sm text-zinc-500">Max 1MB files are allowed</span>
        </label>
      </div>
      
      <div className="text-zinc-500 text-sm text-center">
        Only support jpg, png and svg
      </div>
    </div>
  );
}

// Main Upload Modal Component
export default function UploadModal({
  isOpen,
  onOpenChange,
  onFileSelect,
  onUrlUpload,
  onDelete,
}: UploadModalProps & { onDelete?: () => void }) {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'initial',
    source: null,
  });
  const [fileUrl, setFileUrl] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);

  // Resetear el estado cuando el modal se cierra
  useEffect(() => {
    if (!isOpen) {
      // Si no estamos en modo reemplazo, reseteamos todo
      if (!isReplacing) {
        setUploadState({
          status: 'initial',
          source: null,
        });
        setFileUrl('');
      }
    }
  }, [isOpen]);

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const validateImage = async (file: File): Promise<{ valid: boolean; error?: { message: string; subMessage: string } }> => {
    // Validar formato
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: {
          message: 'Invalid format.',
          subMessage: 'Only PNG, JPG, and SVG are supported.'
        }
      };
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: {
          message: 'The file is too large (Max: 1MB).',
          subMessage: 'Try compressing it.'
        }
      };
    }

    // Validar dimensiones
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

  const handleUrlUpload = async () => {
    if (!isValidUrl(fileUrl)) {
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

    setUploadState({
      status: 'uploading',
      source: 'url',
    });

    try {
      const response = await fetch(fileUrl);
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
      setUploadState({
        status: 'error',
        source: 'url',
        error: {
          message: 'Invalid URL.',
          subMessage: 'Make sure the link points to a valid image.'
        }
      });
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

    setTimeout(() => {
      setUploadState(prev => ({
        ...prev,
        status: 'success'
      }));
      if (onFileSelect) onFileSelect(file);
    }, 2000);
  };

  const handleCancel = () => {
    // Limpiar cualquier ObjectURL creado
    if (uploadState.fileInfo?.url) {
      URL.revokeObjectURL(uploadState.fileInfo.url);
    }

    setUploadState({
      status: 'initial',
      source: null,
    });
    setFileUrl('');
  };

  const handleDone = () => {
    onOpenChange(false);
    setIsReplacing(false);
  };

  const handleDelete = () => {
    // Primero llamamos al callback de eliminación
    if (onDelete) {
      onDelete();
    }
    
    // Limpiamos cualquier ObjectURL creado
    if (uploadState.fileInfo?.url) {
      URL.revokeObjectURL(uploadState.fileInfo.url);
    }
    
    // Reseteamos el estado del modal
    setUploadState({
      status: 'initial',
      source: null
    });
    setFileUrl('');
    
    // Llamamos a onFileSelect con null para limpiar el formulario
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

  // Limpiar ObjectURLs al desmontar
  useEffect(() => {
    return () => {
      if (uploadState.fileInfo?.url) {
        URL.revokeObjectURL(uploadState.fileInfo.url);
      }
    };
  }, []);

  const renderContent = () => {
    switch (uploadState.status) {
      case 'uploading':
        return <UploadingState onCancel={handleCancel} />;
      case 'success':
        return <UploadSuccessState onClose={handleDone} />;
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
    // Si hay una imagen en el estado (ya sea cargada o en proceso), mostramos su preview
    if (uploadState.fileInfo && uploadState.status !== 'error') {
      return (
        <div className="w-full">
          <p className="text-sm font-medium text-white mb-2">
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

    // Si no hay imagen, no estamos cargando y no hay error, mostramos la sección de URL
    if (uploadState.status !== 'uploading' && uploadState.status !== 'error') {
      return (
        <div className="w-full space-y-2">
          <p className="text-sm font-medium text-white">Upload from URL</p>
          <div className="flex items-center gap-2 p-4 bg-zinc-800 rounded-md">
            <svg
              className="w-5 h-5 text-zinc-400"
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
              className="border-none !bg-transparent text-white h-8 focus-visible:ring-0 focus-visible:ring-offset-0"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
            />
            <Button 
              className="bg-black text-white hover:bg-zinc-800 rounded-md px-4 py-1"
              disabled={!isValidUrl(fileUrl)}
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
            // Restauramos el estado anterior
            if (uploadState.fileInfo) {
              setUploadState(prev => ({
                ...prev,
                status: prev.status === 'error' ? 'error' : 'success'
              }));
            }
          } else {
            // Si no estamos reemplazando, reseteamos todo
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
      className="bg-zinc-900 text-white"
      contentClassName="py-4"
    />
  );
}

import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from '@/constants/upload';

interface ValidationResult {
  valid: boolean;
  error?: {
    message: string;
    subMessage: string;
  };
}

export const useImageValidation = () => {
  const validateImage = async (file: File): Promise<ValidationResult> => {
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

    // Validar tamaño solo para PNG y JPG
    if (file.type !== 'image/svg+xml' && file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: {
          message: 'The file is too large (Max: 1MB).',
          subMessage: 'Try compressing it.'
        }
      };
    }

    // Validar dimensiones solo para PNG y JPG
    if (file.type !== 'image/svg+xml') {
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
    }

    // Si es SVG, lo validamos simplemente intentando cargarlo
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ valid: true });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          valid: false,
          error: {
            message: 'Invalid SVG.',
            subMessage: 'The file could not be loaded as an SVG image.'
          }
        });
      };
      
      img.src = objectUrl;
    });
  };

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return {
    validateImage,
    validateUrl
  };
}; 
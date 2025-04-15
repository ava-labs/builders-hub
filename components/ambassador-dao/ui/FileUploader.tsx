import React from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";

type FileUploaderProps = {
  files?: File[] | File | null;
  setFiles?: React.Dispatch<React.SetStateAction<File[]>>;
  handleFileUpload: any
  removeFile?: any;
  
  singleFile?: boolean;
  previewUrl?: string | null;
  fileName?: string;
  
  isUploading?: boolean;
  accept: string;
  maxFiles?: number;
  inputId: string;
  description?: string;
  label?: string;
  required?: boolean;
  recommendedSize?: string;
  maxSize?: string;
  allowedFileTypes?: string;
  height?: string;

  fileSize?: number;
};

const FileUploader: React.FC<FileUploaderProps> = ({
  files,
  setFiles,
  handleFileUpload,
  removeFile,
  singleFile = false,
  previewUrl,
  fileName,
  isUploading = false,
  accept,
  maxFiles = 3,
  inputId,
  description,
  label,
  required = false,
  recommendedSize,
  maxSize = "Max 1 MB files are allowed",
  allowedFileTypes,
  height = "h-32",
  fileSize
}) => {
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (singleFile) {
        handleFileUpload(e.dataTransfer.files[0]);
      } else {
        const newFiles = Array.from(e.dataTransfer.files);
        handleFileUpload(newFiles);
      }
    }
  };

  const renderMultipleFilesPreview = () => {
    if (!files || !Array.isArray(files) || files.length === 0) return null;

    return (
      <div className="w-full mb-4">
        {files.map((file, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 border border-[var(--default-border-color)] rounded-md mb-2"
          >
            <div className="flex items-center">
              <FileText
                className="h-5 w-5 mr-2"
                color="var(--white-text-color)"
              />
              <div className="text-sm">
                <p className="text-[var(--primary-text-color)] font-medium">
                  {file.name}
                </p>
                <p className="text-xs text-[var(--secondary-text-color)]">
                  {Math.round(file.size / 1024)}kb
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeFile(index);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" color="var(--white-text-color)" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderSingleFilePreview = () => {
    if (!previewUrl && !fileName) return null;

    return (
      <div
        className="rounded-md my-2 flex flex-col border border-[var(--default-border-color)] p-3 text-sm cursor-pointer"
        onClick={() => document.getElementById(inputId)?.click()}
      >
        {previewUrl && (
          <div className="rounded flex items-center overflow-hidden relative">
            <div className="flex gap-3">
              <img
                src={previewUrl}
                alt="File preview"
                className="object-cover w-12 h-12 rounded-full"
              />
              <div className="flex flex-col">
                <span className="truncate">{fileName}</span>
                <p className="text-xs text-left text-[var(--secondary-text-color)]">
                {fileSize && `${Math.round(fileSize / 1024)}kb`}
              </p>
              </div>
            
            </div>

            <input
              type="file"
              accept={accept}
              className="hidden"
              id={inputId}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files[0]);
                  e.target.value = "";
                }
              }}
            />
          </div>
        )}
      </div>
    );
  };

  const renderUploadArea = () => {
    if (!singleFile && Array.isArray(files) && files.length >= maxFiles) {
      return null;
    }

    if (singleFile && previewUrl) {
      return null;
    }

    return (
      <div
        className={`border border-dashed border-[var(--default-border-color)] rounded-md p-6 flex flex-col items-center justify-center ${height} cursor-pointer`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        {isUploading ? (
          <Loader2
            className="animate-spin"
            size={24}
            color="var(--white-text-color)"
          />
        ) : (
          <>
            <Upload
              size={24}
              className="text-[#6b6b74] dark:text-[#A1A1AA] mb-2"
              color="var(--white-text-color)"
            />
            <p className="text-sm text-[#6b6b74] dark:text-[#A1A1AA]">
              Drag your file(s) or{" "}
              <input
                type="file"
                accept={accept}
                className="hidden"
                id={inputId}
                multiple={!singleFile}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    if (singleFile) {
                      handleFileUpload(e.target.files[0]);
                    } else {
                      const selectedFiles = Array.from(e.target.files);
                      handleFileUpload(selectedFiles);
                    }
                    e.target.value = "";
                  }
                }}
              />
              <label
                htmlFor={inputId}
                className="text-[var(--primary-text-color)] underline cursor-pointer ml-1"
                onClick={(e) => e.stopPropagation()}
              >
                browse
              </label>
            </p>
            {(maxSize || allowedFileTypes) && (
              <p className="text-xs text-[#6b6b74] dark:text-[#A1A1AA] mt-1">
                {maxSize} {allowedFileTypes ? `(${allowedFileTypes})` : ""}
              </p>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="mb-6">
      {label && (
        <label className="block text-sm">
          {label}
          {required && <span className="text-[#FB2C36]">*</span>}
        </label>
      )}

      {recommendedSize && (
        <p className="text-xs text-[#6b6b74] dark:text-[#A1A1AA] mb-2">
          {recommendedSize}
        </p>
      )}

      {description && (
        <p className="text-xs text-[#6b6b74] dark:text-[#A1A1AA] mb-2">
          {description}
        </p>
      )}

      {renderUploadArea()}

      {singleFile && renderSingleFilePreview()}

      {!singleFile && renderMultipleFilesPreview()}
    </div>
  );
};

export default FileUploader;
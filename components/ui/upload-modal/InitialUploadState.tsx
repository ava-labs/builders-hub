interface InitialUploadStateProps {
  onFileSelect?: (file: File | null) => void;
}

export function InitialUploadState({ onFileSelect }: InitialUploadStateProps) {
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
          <span className="text-sm text-zinc-500">Max 1MB for PNG/JPG files</span>
        </label>
      </div>
      
      <div className="text-zinc-500 text-sm text-center">
        Supports JPG, PNG (max 1MB) and SVG (any size)
      </div>
    </div>
  );
} 
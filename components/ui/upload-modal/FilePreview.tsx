import { Button } from '@/components/ui/button';

interface FilePreviewProps {
  name: string;
  size: number;
  url: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function FilePreview({ name, size, url, onEdit, onDelete }: FilePreviewProps) {
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
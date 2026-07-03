'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  required?: boolean;
}

// Standard logo constraints. Square-ish; raster files clamped at a sensible
// minimum so they look sharp on cards.
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const ACCEPTED_EXT = '.png, .jpg, .jpeg, .svg, .webp';
const MIN_DIMENSION = 256; // px — smaller and the card thumbnail looks blurry
const MAX_DIMENSION = 4096; // px — anything beyond this is wasted storage
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const ASPECT_TOLERANCE = 0.15; // ±15% from square is acceptable

interface RasterMetrics {
  width: number;
  height: number;
}

function readImageMetrics(file: File): Promise<RasterMetrics> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Could not read image dimensions'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function validateLogo(file: File): Promise<string | null> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Use a PNG, JPG, SVG or WebP file.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return `Logo must be under ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB.`;
  }
  if (file.type === 'image/svg+xml') {
    // SVGs don't have intrinsic raster size; skip dimension checks.
    return null;
  }
  let metrics: RasterMetrics;
  try {
    metrics = await readImageMetrics(file);
  } catch {
    return 'Could not read the image. Try a different file.';
  }
  if (metrics.width < MIN_DIMENSION || metrics.height < MIN_DIMENSION) {
    return `Logo must be at least ${MIN_DIMENSION}×${MIN_DIMENSION}px (was ${metrics.width}×${metrics.height}).`;
  }
  if (metrics.width > MAX_DIMENSION || metrics.height > MAX_DIMENSION) {
    return `Logo must be under ${MAX_DIMENSION}×${MAX_DIMENSION}px (was ${metrics.width}×${metrics.height}).`;
  }
  const ratio = metrics.width / metrics.height;
  if (ratio < 1 - ASPECT_TOLERANCE || ratio > 1 + ASPECT_TOLERANCE) {
    return `Logo should be roughly square (was ${metrics.width}×${metrics.height}, aspect ${ratio.toFixed(2)}).`;
  }
  return null;
}

export function LogoUploader({ value, onChange, label = 'Logo', required }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    const validation = await validateLogo(file);
    if (validation) {
      toast.error(validation);
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/file', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        toast.error((body as { error?: string }).error ?? 'Upload failed.');
        return;
      }
      onChange(body.url as string);
      toast.success('Logo uploaded.');
    } catch (err) {
      console.error(err);
      toast.error('Network error — try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function clear() {
    onChange('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="pr-field" style={{ gap: 8 }}>
      <label>
        {label}
        {required && <span className="pr-req"> *</span>}
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            position: 'relative',
            width: 64,
            height: 64,
            borderRadius: 12,
            border: '1px dashed var(--pr-g-500)',
            background: 'var(--pr-g-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Logo preview"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <ImagePlus size={20} style={{ color: 'var(--pr-g-600)' }} />
          )}
          {uploading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.7)',
              }}
            >
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--pr-g-800)' }} />
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="pr-btn pr-btn--outline pr-btn--sm"
            >
              {value ? 'Replace' : 'Choose file'}
            </button>
            {value && (
              <button
                type="button"
                onClick={clear}
                disabled={uploading}
                className="pr-btn pr-btn--ghost pr-btn--sm"
              >
                <X size={14} />
                Remove
              </button>
            )}
          </div>
          <div className="pr-helper" style={{ marginTop: 6 }}>
            <span>
              Square PNG/JPG/SVG/WebP · min {MIN_DIMENSION}×{MIN_DIMENSION}px · under{' '}
              {(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB
            </span>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXT}
        className="pr-sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}

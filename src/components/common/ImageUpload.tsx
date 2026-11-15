import React, { useState, useRef } from 'react';
import { Upload, X, RefreshCw, AlertCircle, Loader2, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { api } from '../../services/api';

export interface ImageUploadMetadata {
  public_id?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export interface ImageUploadProps {
  value?: string;
  onChange: (url: string, metadata?: ImageUploadMetadata) => void;
  folder?: string;
  label?: string;
  helperText?: string;
  aspectRatio?: 'square' | 'video' | 'banner' | 'auto';
  maxSizeMB?: number;
  disabled?: boolean;
  className?: string;
  allowManualUrl?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value = '',
  onChange,
  folder = 'general',
  label,
  helperText,
  aspectRatio = 'auto',
  maxSizeMB = 10,
  disabled = false,
  className = '',
  allowManualUrl = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const aspectClass = {
    square: 'aspect-square max-w-[200px]',
    video: 'aspect-video max-w-full',
    banner: 'h-36 sm:h-44 w-full',
    auto: 'min-h-[140px] max-h-[260px] w-full',
  }[aspectRatio];

  const validateFile = (file: File): string | null => {
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      return 'Only JPG, JPEG, PNG, or WebP images are supported.';
    }
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return `File size exceeds the ${maxSizeMB}MB limit. (Selected: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`;
    }
    return null;
  };

  const handleFileUpload = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(20);

    try {
      const progressTimer = setInterval(() => {
        setProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 200);

      const res = await api.uploadImage(file, folder);

      clearInterval(progressTimer);
      setProgress(100);

      if (res && (res.secure_url || res.url)) {
        const finalUrl = res.secure_url || res.url;
        onChange(finalUrl, {
          public_id: res.public_id,
          width: res.width,
          height: res.height,
          format: res.format,
          bytes: res.bytes,
        });
      } else {
        throw new Error('Upload succeeded but no secure URL was returned.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || uploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setError(null);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label & Header */}
      <div className="flex items-center justify-between">
        {label && <label className="text-xs font-bold uppercase tracking-wider text-stone-300">{label}</label>}
        {allowManualUrl && !disabled && (
          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-[11px] text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
          >
            <LinkIcon className="w-3 h-3" />
            {showManualInput ? 'Hide URL input' : 'Enter URL instead'}
          </button>
        )}
      </div>

      {/* Manual URL Input Fallback */}
      {showManualInput && (
        <div className="relative">
          <input
            type="url"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || uploading}
            placeholder="https://example.com/image.jpg"
            className="w-full bg-stone-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      )}

      {/* Main Upload Dropzone or Preview */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => {
          if (!disabled && !uploading && fileInputRef.current) {
            fileInputRef.current.click();
          }
        }}
        className={`relative overflow-hidden rounded-xl border-2 transition-all cursor-pointer ${
          isDragging
            ? 'border-amber-500 bg-amber-500/10 scale-[1.01]'
            : 'border-white/10 hover:border-amber-500/50 bg-stone-950/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg"
          onChange={handleFileChange}
          disabled={disabled || uploading}
          className="hidden"
        />

        {value ? (
          /* Preview Mode */
          <div className={`relative w-full ${aspectClass} overflow-hidden group bg-stone-900 flex items-center justify-center`}>
            <img
              src={value}
              alt="Uploaded Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                // If invalid or broken URL
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=400&q=80';
              }}
            />

            {/* Hover Actions Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={uploading}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg shadow-lg flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg shadow-lg flex items-center gap-1.5 transition-all"
              >
                <X className="w-3.5 h-3.5" />
                Remove
              </button>
            </div>
          </div>
        ) : (
          /* Empty Upload Dropzone */
          <div className={`p-6 flex flex-col items-center justify-center text-center ${aspectClass}`}>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-stone-200">
              <span className="text-amber-500 underline underline-offset-2">Click to upload</span> or drag and drop
            </p>
            <p className="text-[11px] text-stone-400 mt-1">
              JPG, PNG, or WebP (max {maxSizeMB}MB)
            </p>
          </div>
        )}

        {/* Uploading Spinner Overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-4">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-2" />
            <p className="text-xs font-bold text-white tracking-wide">Uploading Image...</p>
            <div className="w-40 bg-stone-800 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Helper text */}
      {helperText && !error && <p className="text-[11px] text-stone-400">{helperText}</p>}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;

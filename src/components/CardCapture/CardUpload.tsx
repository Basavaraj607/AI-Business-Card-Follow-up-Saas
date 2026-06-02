// components/CardCapture/CardUpload.tsx
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileImage, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  onFile: (file: File) => void;
}

export function CardUpload({ onFile }: Props) {
  const onDrop = useCallback(
    (accepted: File[], rejected: any[]) => {
      if (rejected.length > 0) {
        const error = rejected[0].errors[0];
        if (error.code === 'file-too-large') {
          toast.error('File is too large. Maximum size is 10MB.');
        } else {
          toast.error(error.message || 'Invalid file format.');
        }
        return;
      }
      if (accepted[0]) {
        onFile(accepted[0]);
      }
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl flex flex-col items-center justify-center
        gap-4 p-10 cursor-pointer transition-all duration-200 outline-none
        ${isDragActive 
          ? 'border-brand-500 bg-brand-50/50 scale-[1.01] shadow-inner' 
          : 'border-gray-200 bg-gray-50/30 hover:border-brand-400 hover:bg-gray-50'
        }
      `}
    >
      <input {...getInputProps()} />
      <div 
        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-200
          ${isDragActive ? 'bg-brand-100 text-brand-600 scale-110' : 'bg-gray-100 text-gray-400'}
        `}
      >
        {isDragActive ? <FileImage size={24} /> : <Upload size={24} />}
      </div>
      <div className="text-center space-y-1">
        <p className="font-semibold text-sm text-gray-800">
          {isDragActive ? 'Drop the file here' : 'Drop card image here'}
        </p>
        <p className="text-xs text-gray-500">
          Or <span className="text-brand-600 font-medium">browse local files</span>
        </p>
        <p className="text-[10px] text-gray-400">
          JPG, PNG, or WEBP · Max 10MB
        </p>
      </div>
    </div>
  );
}

export default CardUpload;
'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface PhotoUploadProps {
  onFile: (file: File) => void;
  isLoading?: boolean;
  error?: string;
}

export function PhotoUpload({ onFile, isLoading = false, error }: PhotoUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const dragZoneRef = useRef<HTMLDivElement>(null);

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      onFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 p-8 text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="mx-auto mb-4 text-5xl"
        >
          🔍
        </motion.div>
        <p className="text-sm font-semibold text-primary-700">מנתח תמונה...</p>
        <p className="mt-2 text-xs text-primary-600">זה יכול לקחת כמה שניות</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drag & Drop Zone */}
      <motion.div
        ref={dragZoneRef}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={`
          relative rounded-2xl border-2 border-dashed transition-all duration-200 p-8
          ${
            isDragActive
              ? 'border-primary-500 bg-primary-50 scale-105'
              : 'border-neutral-200 bg-white hover:border-primary-300 hover:bg-primary-50'
          }
        `}
      >
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={isDragActive ? { y: -4 } : { y: 0 }}
            className="text-5xl"
          >
            📸
          </motion.div>
          <div className="text-center">
            <p className="text-sm font-semibold text-black-matte">גרור תמונה לכאן</p>
            <p className="text-xs text-neutral-500 mt-1">או לחץ לבחירה מהגלריה</p>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </motion.div>

      {/* Camera & Gallery Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          onClick={() => cameraInputRef.current?.click()}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center gap-2 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 p-4 text-white shadow-lg hover:shadow-xl transition-shadow"
        >
          <span className="text-2xl">📷</span>
          <span className="text-xs font-semibold">מצלמה</span>
        </motion.button>

        <motion.button
          onClick={() => galleryInputRef.current?.click()}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col items-center gap-2 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 p-4 text-white shadow-lg hover:shadow-xl transition-shadow"
        >
          <span className="text-2xl">🖼️</span>
          <span className="text-xs font-semibold">גלריה</span>
        </motion.button>
      </div>

      {/* Hidden camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="hidden"
      />

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-600"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}

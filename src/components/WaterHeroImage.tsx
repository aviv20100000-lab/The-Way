'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function WaterHeroImage() {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const res = await fetch('/api/generate-water-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (data.imageUrl) {
          setImageUrl(data.imageUrl);
        }
      } catch (err) {
        console.error('Error fetching image:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchImage();
  }, []);

  return (
    <motion.div
      className="relative rounded-3xl overflow-hidden shadow-lg aspect-square w-full mb-6 bg-gradient-to-br from-neutral-200 to-neutral-300"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {imageUrl && (
        <motion.img
          src={imageUrl}
          alt="Motivation - Woman drinking water"
          className="w-full h-full object-cover"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />

      {/* Loading Skeleton */}
      {loading && (
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-300 via-neutral-200 to-neutral-300 animate-pulse" />
      )}

      {/* Overlay Text */}
      <motion.div
        className="absolute bottom-4 left-5 text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <p className="text-2xl font-bold">💧 היום</p>
      </motion.div>
    </motion.div>
  );
}

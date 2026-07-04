'use client';

import { motion } from 'framer-motion';

interface WaterHeroImageProps {
  progressPercent: number;
}

export function WaterHeroImage({ progressPercent }: WaterHeroImageProps) {
  const clampedProgress = Math.min(100, Math.max(0, progressPercent));
  const waterLevelOffset = 70 - clampedProgress * 2.2;
  const waterSurfaceY = 240 - clampedProgress * 2.4;

  return (
    <motion.div
      className="flex justify-center items-center mb-4"
      style={{ height: '260px' }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, type: 'spring', stiffness: 80 }}
    >
      <style>{`
        @keyframes waveMove {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes dropFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-10px) scale(1.02); }
        }
        @keyframes dropGlow {
          0%, 100% { filter: drop-shadow(0 0 18px rgba(56,189,248,0.45)) drop-shadow(0 0 40px rgba(56,189,248,0.18)); }
          50%       { filter: drop-shadow(0 0 32px rgba(56,189,248,0.75)) drop-shadow(0 0 65px rgba(56,189,248,0.30)); }
        }
        @keyframes shimmerDrop {
          0%   { opacity: 0.4; transform: translateY(0) rotate(-20deg); }
          50%  { opacity: 0.8; }
          100% { opacity: 0.4; transform: translateY(4px) rotate(-20deg); }
        }
        .drop-animate {
          animation: dropFloat 4s ease-in-out infinite, dropGlow 3s ease-in-out infinite;
        }
      `}</style>

      <svg
        viewBox="0 0 200 260"
        width="200"
        height="260"
        className="drop-animate"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Clip to teardrop shape */}
          <clipPath id="dropClip">
            <path d="M100 10 C100 10, 170 90, 170 160 C170 207 138 240 100 240 C62 240 30 207 30 160 C30 90 100 10 100 10 Z" />
          </clipPath>

          {/* Radial glow inside drop */}
          <radialGradient id="dropInner" cx="50%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="45%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* Outer glow filter */}
          <filter id="outerGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer ambient glow (not clipped) */}
        <ellipse cx="100" cy="160" rx="72" ry="62"
          fill="rgba(56,189,248,0.08)"
          filter="url(#outerGlow)" />

        {/* Drop body — dark water */}
        <path
          d="M100 10 C100 10, 170 90, 170 160 C170 207 138 240 100 240 C62 240 30 207 30 160 C30 90 100 10 100 10 Z"
          fill="#0c2a3e"
        />

        {/* Animated waves inside drop */}
        <g clipPath="url(#dropClip)">
          <motion.rect
            x="0"
            y="0"
            width="200"
            height="260"
            fill="url(#waterFill)"
            initial={false}
            animate={{ y: waterSurfaceY }}
            transition={{ type: 'spring', stiffness: 45, damping: 18, mass: 0.9 }}
          />
          <motion.g
            initial={false}
            animate={{ y: waterLevelOffset }}
            transition={{ type: 'spring', stiffness: 45, damping: 18, mass: 0.9 }}
          >
          {/* Wave 1 — main */}
          <g style={{ animation: 'waveMove 3.2s linear infinite' }}>
            <path
              d="M-10 175 Q15 162 40 175 Q65 188 90 175 Q115 162 140 175 Q165 188 190 175 Q215 162 240 175 Q265 188 290 175 L290 260 L-10 260 Z"
              fill="rgba(14,165,233,0.92)"
            />
          </g>
          {/* Wave 2 — slightly offset */}
          <g style={{ animation: 'waveMove 4.1s linear infinite reverse' }}>
            <path
              d="M-10 185 Q20 170 50 185 Q80 200 110 185 Q140 170 170 185 Q200 200 230 185 Q260 170 290 185 L290 260 L-10 260 Z"
              fill="rgba(56,189,248,0.68)"
            />
          </g>
          {/* Wave 3 — deep fill */}
          <g style={{ animation: 'waveMove 5s linear infinite' }}>
            <path
              d="M-10 195 Q25 183 60 195 Q95 207 130 195 Q165 183 200 195 Q235 207 270 195 L270 260 L-10 260 Z"
              fill="rgba(2,132,199,0.94)"
            />
          </g>
          {/* solid fill bottom */}
          <rect x="-10" y="210" width="310" height="60" fill="#0284c7" />
          </motion.g>

          {/* Inner glow overlay */}
          <path
            d="M100 10 C100 10, 170 90, 170 160 C170 207 138 240 100 240 C62 240 30 207 30 160 C30 90 100 10 100 10 Z"
            fill="url(#dropInner)"
          />
        </g>

        {/* Drop outline */}
        <path
          d="M100 10 C100 10, 170 90, 170 160 C170 207 138 240 100 240 C62 240 30 207 30 160 C30 90 100 10 100 10 Z"
          fill="none"
          stroke="rgba(125,211,252,0.5)"
          strokeWidth="1.5"
        />

        {/* Highlight — top left glint */}
        <ellipse
          cx="78" cy="72" rx="14" ry="26"
          fill="rgba(186,230,253,0.30)"
          style={{ animation: 'shimmerDrop 3.5s ease-in-out infinite', transformOrigin: '78px 72px' }}
        />
        {/* Small secondary glint */}
        <ellipse cx="88" cy="105" rx="5" ry="9"
          fill="rgba(186,230,253,0.18)"
        />

        {/* Bubble 1 */}
        <circle cx="70" cy="195" r="5" fill="none" stroke="rgba(125,211,252,0.55)" strokeWidth="1" />
        <circle cx="70" cy="195" r="1.5" fill="rgba(186,230,253,0.5)" />
        {/* Bubble 2 */}
        <circle cx="128" cy="205" r="3.5" fill="none" stroke="rgba(125,211,252,0.45)" strokeWidth="1" />
        <circle cx="128" cy="205" r="1" fill="rgba(186,230,253,0.4)" />
        {/* Bubble 3 */}
        <circle cx="95" cy="215" r="2.5" fill="none" stroke="rgba(125,211,252,0.35)" strokeWidth="1" />
      </svg>
    </motion.div>
  );
}

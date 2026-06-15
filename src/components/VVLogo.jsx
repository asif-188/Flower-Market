import React from 'react';

/**
 * VV Logo — gold gradient double-V with a swoosh wave,
 * matching the reference image style.
 *
 * Props:
 *   size   – height in px (width scales proportionally), default 48
 *   dark   – if true, renders on dark background (for standalone use)
 */
const VVLogo = ({ size = 48, dark = false }) => {
  const w = size * 1.5;
  const h = size;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 150 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        {/* Gold gradient — top highlight to deep gold */}
        <linearGradient id="vv-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#ffe08a" />
          <stop offset="35%"  stopColor="#f5c842" />
          <stop offset="65%"  stopColor="#d4a017" />
          <stop offset="100%" stopColor="#a67c00" />
        </linearGradient>

        {/* Lighter gold for swoosh */}
        <linearGradient id="vv-swoosh" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#ffe08a" stopOpacity="0.4" />
          <stop offset="40%"  stopColor="#f5c842" stopOpacity="0.95" />
          <stop offset="60%"  stopColor="#ffe08a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#d4a017" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* ── Left V ── */}
      {/* Left serif top-left leg */}
      <path
        d="M 8 12 L 8 18 L 13 18 L 36 80 L 48 80 L 26 18 L 30 18 L 30 12 Z"
        fill="url(#vv-gold)"
      />
      {/* Left serif top-right leg */}
      <path
        d="M 58 12 L 58 18 L 62 18 L 48 56 L 42 38 L 36 55 L 48 80 L 60 56 L 74 18 L 78 18 L 78 12 Z"
        fill="url(#vv-gold)"
      />

      {/* ── Right V ── */}
      {/* Right serif top-left leg */}
      <path
        d="M 72 12 L 72 18 L 76 18 L 99 80 L 111 80 L 89 18 L 92 18 L 92 12 Z"
        fill="url(#vv-gold)"
      />
      {/* Right serif top-right leg */}
      <path
        d="M 120 12 L 120 18 L 124 18 L 111 56 L 105 38 L 99 55 L 111 80 L 123 56 L 137 18 L 141 18 L 141 12 Z"
        fill="url(#vv-gold)"
      />

      {/* ── Swoosh wave ── */}
      <path
        d="M 5 58 C 30 48, 55 70, 75 52 C 95 34, 120 62, 145 52"
        stroke="url(#vv-swoosh)"
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Thin inner swoosh highlight */}
      <path
        d="M 5 62 C 30 52, 55 74, 75 56 C 95 38, 120 66, 145 56"
        stroke="url(#vv-swoosh)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
};

export default VVLogo;

import React from 'react';

export default function NorthCompass() {
  return (
    <div style={{
      position: 'absolute',
      top: 20,
      right: 24,
      zIndex: 1200,
      width: 48,
      height: 48,
      background: 'rgba(255,255,255,0.95)',
      borderRadius: '50%',
      boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="15" fill="#fff" stroke="#888" strokeWidth="2" />
        <polygon points="16,6 20,20 16,17 12,20" fill="#e53e3e" stroke="#e53e3e" strokeWidth="1" />
        <text x="16" y="28" textAnchor="middle" fontSize="10" fill="#222">N</text>
      </svg>
    </div>
  );
}

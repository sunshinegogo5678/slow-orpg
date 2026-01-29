import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="currentColor" 
      className={className}
      aria-label="SLOW ORPG Logo"
    >
      {/* Top Left */}
      <path d="M0 0 L50 0 A50 50 0 0 0 0 50 Z" />
      {/* Top Right */}
      <path d="M100 0 L100 50 A50 50 0 0 0 50 0 Z" />
      {/* Bottom Right */}
      <path d="M100 100 L50 100 A50 50 0 0 0 100 50 Z" />
      {/* Bottom Left */}
      <path d="M0 100 L0 50 A50 50 0 0 0 50 100 Z" />
    </svg>
  );
};
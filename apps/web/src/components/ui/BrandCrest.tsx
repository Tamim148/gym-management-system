'use client';

import Image from 'next/image';

interface BrandCrestProps {
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}

export function BrandCrest({
  size = 44,
  className = '',
  priority = false,
  alt = 'Vintage Aesthetics Gym Crest',
}: BrandCrestProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 overflow-hidden rounded-full border border-silver/35 bg-obsidian ${className}`}
    >
      <Image
        src="/images/logo.jpg"
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        className="h-full w-full object-cover object-center"
      />
    </div>
  );
}

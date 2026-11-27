'use client';

export function SkeletonBlock({
  className = 'h-20 w-full',
  lightMode = false,
}: {
  className?: string;
  lightMode?: boolean;
}) {
  return (
    <div
      className={`animate-pulse rounded-xl ${
        lightMode ? 'bg-zinc-200/80' : 'bg-steel/60'
      } ${className}`}
    />
  );
}

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-4xl' : 'text-2xl';
  return (
    <span className="flex items-center gap-2">
      <svg width={size === 'lg' ? 40 : 28} height={size === 'lg' ? 40 : 28} viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="14" fill="none" stroke="var(--color-gold)" strokeWidth="1.5" />
        <path d="M21 8a9 9 0 1 0 0 16 7 7 0 1 1 0-16z" fill="var(--color-gold)" />
        <circle cx="10" cy="10" r="1.2" fill="var(--color-gold-soft)" />
      </svg>
      <span className={`font-display ${text} font-semibold tracking-wide text-gold-soft`}>Jotaish</span>
    </span>
  );
}

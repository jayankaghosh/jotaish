export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-3xl' : 'text-xl';
  const mark = size === 'lg' ? 52 : 34;
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.svg" width={mark} height={mark} alt="" aria-hidden />
      <span className={`font-display ${text} font-semibold text-gold-soft`}>Jotaish</span>
    </span>
  );
}

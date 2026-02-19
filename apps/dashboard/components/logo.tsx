export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>

      {/* Edges */}
      <line x1="8" y1="6" x2="20" y2="10" stroke="url(#logo-grad)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8" y1="6" x2="8" y2="18" stroke="url(#logo-grad)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="20" y1="10" x2="20" y2="22" stroke="url(#logo-grad)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8" y1="18" x2="20" y2="22" stroke="url(#logo-grad)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8" y1="18" x2="20" y2="10" stroke="url(#logo-grad)" strokeWidth="1.8" strokeLinecap="round" opacity="0.35" />

      {/* Nodes */}
      <circle cx="8" cy="6" r="3" fill="url(#logo-grad)" />
      <circle cx="20" cy="10" r="3" fill="url(#logo-grad)" />
      <circle cx="8" cy="18" r="3" fill="url(#logo-grad)" />
      <circle cx="20" cy="22" r="3" fill="url(#logo-grad)" />
    </svg>
  );
}

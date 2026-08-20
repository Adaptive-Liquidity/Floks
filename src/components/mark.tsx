export function FlockMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className={className}>
      <rect x="0" y="0" width="12" height="12" rx="3.2" fill="#C6F84E" />
      <rect x="16" y="0" width="12" height="12" rx="3.2" fill="#FF7A5C" />
      <rect x="0" y="16" width="12" height="12" rx="3.2" fill="#4E9BFF" />
      <rect x="16" y="16" width="12" height="12" rx="3.2" fill="#2FD98A" />
    </svg>
  );
}

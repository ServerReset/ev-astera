/**
 * Astera Labs brand mark: a stylized "A" built from the real Astera Labs brand colors
 * (#3c79bc blue, #656769 gray) on a black rounded square — matches the app's icon/favicon
 * assets in client/public/. Rendered inline (not <img>) so it scales crisply at any size.
 */
export function AsteraMark({ size = 40, className }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill="#000000" />
      <path d="M32 10 L14 54" fill="none" stroke="#3c79bc" strokeWidth="8" strokeLinecap="round" />
      <path d="M32 10 L50 54" fill="none" stroke="#656769" strokeWidth="8" strokeLinecap="round" />
      <path d="M20.5 38 L43.5 38" fill="none" stroke="#3c79bc" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

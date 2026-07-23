/**
 * Official Astera Labs symbol. Astera ships this as two variants — solid white for dark
 * backgrounds, two-tone gray+blue for light — so it follows the app's theme via
 * --c-mark-primary/--c-mark-secondary (index.css) instead of a fixed color.
 * viewBox pads the glyph's native 1541x1389 box to a centered 1541x1541 square.
 */
export function AsteraMark({ size = 40, className }) {
  return (
    <svg viewBox="0 -76 1541 1541" width={size} height={size} className={className} aria-hidden="true">
      <path
        fill="rgb(var(--c-mark-primary))"
        d="m1189.2 1252.5 59.8 102.1 11 22.5 5.6 11.5H71.4q-19.8 0-34-8.7-17-8.3-28.5-25.3-8.3-19.8-8.3-36.8 0-19.7 8.3-36.8l337-586.1L725.3 34.7l11-22.5L745 .7l8.3 11.5 11.5 22.5 56.6 102.1q11.5 17 11.5 36.7 0 17-11.5 34.1L243.8 1215.8h883.4q19.7 0 36.7 11.5 14.3 8.2 25.3 25.2"
      />
      <path
        fill="rgb(var(--c-mark-secondary))"
        d="M1081.6 1133.5H512.8q-19.7 0-36.7-8.3-17.1-11.5-25.3-28.5-11.5-17-11.5-34 0-19.8 11.5-36.8l379.3-662.5q11.1-17 25.3-25.3 17-11.5 36.8-11.5t34 11.5q17 8.3 25.3 25.3l568.8 991.2 14.3 22.5 5.9 11.5h-155.8q-19.8 0-36.8-8.7-14.3-8.3-25.3-25.3L892.2 601.1l-45.5 76.8-161 283.2H980q19.8 0 36.8 8.2 17 11.5 25.3 28.5l59.3 102.1 11.5 19.8 8.7 13.8h-14.2z"
      />
    </svg>
  );
}

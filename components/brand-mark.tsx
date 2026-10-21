/** The shamiana canopy: a peaked roof over a scalloped valance. Decorative. */
export function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 40 32"
      width="40"
      height="32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 14 L20 3 L38 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M4 14 q3 5 6 0 q3 5 6 0 q3 5 6 0 q3 5 6 0 q3 5 6 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M8 18 V30 M32 18 V30"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A thin row of scallops, the edge of a tent, used under the header. */
export function ScallopRule() {
  return (
    <svg className="scallop-rule" width="100%" height="10" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="scallop" width="20" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 1 q5 8 10 0 q5 8 10 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect width="100%" height="10" fill="url(#scallop)" />
    </svg>
  );
}

/**
 * Custom inline SVG icons for the Create L1 questionnaire.
 * Brand logos and meaningful icons instead of generic lucide ones.
 */

/** Avalanche triangle logo — red, used for C-Chain */
export function AvaxLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="38 28 158 142" className={className}>
      <path
        fill="currentColor"
        d="M95.2 163.4h-43c-4.5 0-6.7 0-8-1a5.7 5.7 0 0 1-2.2-4.6c.1-1.6 1.3-3.5 3.5-7.3l62.7-110c2.3-3.9 3.4-5.8 4.8-6.5a5.7 5.7 0 0 1 5 0c1.4.7 2.6 2.6 4.9 6.5l12.9 22.5.1.1c2.5 4.3 3.7 6.5 4.3 8.8a19 19 0 0 1 0 9.3c-.6 2.3-1.8 4.5-4.3 9l-33 57.8-.1.2c-2.4 4.3-3.7 6.5-5.4 8.2a19 19 0 0 1-8 4.8c-2.2.8-4.7.8-9.7.8Zm62.4 0h31.2c4.5 0 6.7 0 8-1a5.7 5.7 0 0 0 2.2-4.6c-.1-1.6-1.2-3.5-3.5-7.2l-15.7-27.2c-2.2-3.8-3.4-5.7-4.8-6.4a5.7 5.7 0 0 0-5 0c-1.3.7-2.5 2.6-4.8 6.4L149.6 151l-.1.2c-2.3 3.8-3.4 5.7-3.4 7.3a5.7 5.7 0 0 0 2.2 4.5c1.3 1 3.6 1 8 1Z"
      />
    </svg>
  );
}

/** Stacked layers — L1 chain / "your own chain" */
export function LayersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    </svg>
  );
}

/** Docker whale logo */
export function DockerLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.186.186 0 0 0-.185.186v1.887c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.186.186 0 0 0-.186.185v1.888c0 .102.084.185.186.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.186.186 0 0 0-.186.185v1.887c0 .102.084.186.186.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.186.186 0 0 0-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.186.186 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.186v1.887c0 .102.083.185.185.185m-2.964 0h2.119a.186.186 0 0 0 .185-.185V9.006a.186.186 0 0 0-.185-.186H5.136a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.186v1.887c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" />
    </svg>
  );
}

/** Ava Labs / managed infrastructure icon */
export function ManagedIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01" />
      <path d="M6 14h12" />
      <path d="M12 2v4" />
      <path d="M8 2h8" />
    </svg>
  );
}

/** Cloud / server rack — production deployment */
export function CloudDeployIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <path d="m9.5 15 3-3 3 3" />
      <path d="M12 12v7" />
    </svg>
  );
}

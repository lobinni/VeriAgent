"use client";

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Shield outline */}
      <path
        d="M32 4 L56 16 V36 L32 58 L8 36 V16 Z"
        fill="none"
        stroke="var(--teal)"
        strokeWidth="2.8"
        strokeLinejoin="round"
        opacity="0.85"
      />
      {/* Verification checkmark */}
      <path
        d="M20 32 l6 6 L44 22"
        fill="none"
        stroke="var(--teal)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Score bars inside shield */}
      <rect x="14" y="38" width="6" height="8" rx="1.5" fill="var(--text-3)" opacity="0.6" />
      <rect x="22" y="35" width="6" height="11" rx="1.5" fill="var(--teal)" />
      <rect x="30" y="32" width="6" height="14" rx="1.5" fill="var(--pass)" />
      <rect x="38" y="29" width="6" height="17" rx="1.5" fill="var(--blue)" opacity="0.7" />
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <a className="logo" href="#top" aria-label="VeriAgent home">
      <LogoMark size={size} />
      <span className="logo-word">
        Veri<b>Agent</b>
      </span>
    </a>
  );
}

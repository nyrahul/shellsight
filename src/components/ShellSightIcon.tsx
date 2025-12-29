interface ShellSightIconProps {
  className?: string;
}

export default function ShellSightIcon({ className = "w-6 h-6" }: ShellSightIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Terminal window background */}
      <rect x="2" y="4" width="28" height="24" rx="3" fill="#1e293b" />

      {/* Terminal title bar */}
      <rect x="2" y="4" width="28" height="6" rx="3" fill="#334155" />
      <rect x="2" y="7" width="28" height="3" fill="#334155" />

      {/* Terminal buttons */}
      <circle cx="6" cy="7" r="1.5" fill="#ef4444" />
      <circle cx="10" cy="7" r="1.5" fill="#eab308" />
      <circle cx="14" cy="7" r="1.5" fill="#22c55e" />

      {/* Eye shape inside terminal */}
      <ellipse cx="16" cy="19" rx="9" ry="5" stroke="#3b82f6" strokeWidth="2" fill="none" />

      {/* Eye pupil */}
      <circle cx="16" cy="19" r="3" fill="#3b82f6" />

      {/* Eye highlight */}
      <circle cx="17.5" cy="17.5" r="1" fill="white" />
    </svg>
  );
}

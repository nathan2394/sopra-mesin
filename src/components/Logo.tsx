export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      className="shrink-0"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="16" className="fill-blue-600" />
      <path
        d="M10 20c3.5 0 3.5-8 7-8s3.5 8 7 8"
        className="stroke-white"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="10" cy="20" r="1.8" className="fill-white" />
      <circle cx="24" cy="12" r="1.8" className="fill-white" />
    </svg>
  );
}

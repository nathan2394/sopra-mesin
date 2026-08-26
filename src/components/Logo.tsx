interface Props {
  variant?: "full" | "wordmark" | "mark";
  className?: string;
}

const sources = {
  full: "/nexora-mesin-logo.svg",
  wordmark: "/nexora-mesin-wordmark.svg",
  mark: "/android-chrome-512x512.png",
};

export function Logo({ variant = "full", className = "" }: Props) {
  return (
    <img
      src={sources[variant]}
      alt="Nexora Mesin"
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

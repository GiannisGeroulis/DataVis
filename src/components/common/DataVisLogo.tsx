
interface DataVisLogoProps {
  className?: string;
  size?: number;
}

export default function DataVisLogo({ className = "h-6 w-6", size }: DataVisLogoProps) {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.12" />
      <path
        d="M16 5.5L25.5 11V21L16 26.5L6.5 21V11L16 5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16 11.5V20.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10.5 13.5L16 16.5L21.5 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16.5" r="2.2" fill="currentColor" />
      <circle cx="16" cy="11.5" r="1.4" fill="currentColor" />
      <circle cx="16" cy="20.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

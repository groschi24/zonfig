/* eslint-disable @next/next/no-img-element */
interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="zonfig"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: size * 0.1875 }}
    />
  );
}

export function LogoIcon({ size = 24, className = '' }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="zonfig"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: size * 0.1875 }}
    />
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-ink hover:bg-brand-dark hover:text-white",
  secondary: "bg-white text-ink border border-line hover:bg-surface-muted",
  ghost: "bg-transparent text-ink hover:bg-surface-muted",
  danger: "bg-red-600 text-white hover:bg-red-700",
  dark: "bg-ink text-white hover:bg-graphite",
};
const sizes: Record<Size, string> = {
  sm: "px-3 py-2 text-sm min-h-[40px]",
  md: "px-4 py-3 text-base",
  lg: "px-6 py-4 text-lg",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  full?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  full,
  children,
  ...props
}: BaseProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        full && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  full,
  children,
  href,
  ...props
}: BaseProps & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      className={cn(
        "btn inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
        variants[variant],
        sizes[size],
        full && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

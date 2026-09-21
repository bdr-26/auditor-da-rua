import { cn } from "@/lib/utils";

export type Tone = "green" | "yellow" | "orange" | "red" | "gray" | "brand" | "dark";

const tones: Record<Tone, string> = {
  green: "tone-green",
  yellow: "tone-yellow",
  orange: "tone-orange",
  red: "tone-red",
  gray: "tone-gray",
  brand: "bg-brand-light text-brand-dark",
  dark: "bg-ink text-white",
};

export function Badge({ tone = "gray", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

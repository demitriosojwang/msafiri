import { TrainFront } from "lucide-react";

export function Logo({ size = "md", light = false }: { size?: "sm" | "md" | "lg"; light?: boolean }) {
  const dims = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`${dims} rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0`}>
        <TrainFront className="h-[60%] w-[60%]" />
      </span>
      <span className={`${text} font-bold tracking-tight ${light ? "text-primary-foreground" : "text-primary"}`}>
        Mi<span className="text-accent-foreground">-</span>Reli
      </span>
    </span>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad" | "info";
}) {
  const tones: Record<string, string> = {
    default: "",
    good: "border-emerald-200 bg-emerald-50",
    warn: "border-amber-200 bg-amber-50",
    bad: "border-red-200 bg-red-50",
    info: "border-teal-200 bg-teal-50",
  };
  return (
    <Card className={cn(tones[tone])}>
      <CardContent className="p-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-bold tracking-tight tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

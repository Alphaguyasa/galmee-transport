import { cn } from "@/lib/utils";

/** The destination roll: amber on near-black, the one bold element of the design. */
export function Roll({ origin, destination, className }: { origin: string; destination: string; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 rounded-sm bg-board px-3 py-2 text-xl font-bold text-board-foreground", className)}>
      <span className="min-w-0 truncate">{origin}</span>
      <span aria-hidden>→</span>
      <span className="min-w-0 truncate">{destination}</span>
    </p>
  );
}

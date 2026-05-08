import { useEffect, useState } from "react";
import { PartyPopper, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "gather:promoted-dismissed";

function getDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  localStorage.setItem(KEY, JSON.stringify([...set]));
}

export function PromotedBanner({
  rsvpId,
  promotedAt,
}: {
  rsvpId: string;
  promotedAt: string | null | undefined;
}) {
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);

  useEffect(() => { setDismissed(getDismissed()); }, []);

  if (!promotedAt || !dismissed) return null;
  const ageDays = (Date.now() - new Date(promotedAt).getTime()) / 86_400_000;
  if (ageDays > 7) return null;
  if (dismissed.has(rsvpId)) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
      <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="font-medium">You're in! 🎉</p>
        <p className="text-muted-foreground">You've been promoted from the waitlist.</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => {
          const next = new Set(dismissed);
          next.add(rsvpId);
          saveDismissed(next);
          setDismissed(next);
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

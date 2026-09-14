"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, useMe } from "@/lib/client";
import { daysUntil, fmtDate, ksh } from "@/lib/format";
import { Ticket, Wallet } from "lucide-react";

interface CreditRow {
  id: string;
  amount: number;
  initialAmount: number;
  status: string;
  note: string | null;
  issuedAt: string;
  expiresAt: string;
}

export default function CreditsPage() {
  const { me, loading: meLoading } = useMe();
  const [credits, setCredits] = useState<CreditRow[] | null>(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (!me?.session) return;
    api<{ balance: number; credits: CreditRow[] }>("/api/credits")
      .then((res) => {
        setBalance(res.balance);
        setCredits(res.credits);
      })
      .catch(() => setCredits([]));
  }, [me]);

  if (meLoading) return null;

  if (!me?.session) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">Sign in to see your travel credits</p>
          <Button asChild>
            <Link href="/login?next=/credits">Sign in</Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const styles: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-900 border-emerald-200",
    redeemed: "bg-teal-100 text-teal-900 border-teal-200",
    expired: "bg-stone-100 text-stone-600 border-stone-200",
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">Travel credits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Credits are issued when you cancel after the trip locks — your fare is never lost. They
          apply to any future ride, partial use supported, and they never expire into nothing:
          whatever remains simply stops being redeemable after 30 days.
        </p>

        <Card className="mt-6 border-emerald-200 bg-gradient-to-br from-emerald-50 to-background">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Available balance</p>
              <p className="text-3xl font-bold text-primary">{ksh(balance)}</p>
            </div>
            <Wallet className="h-10 w-10 text-primary/60" />
          </CardContent>
        </Card>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Credit history</h2>
          {credits === null && <Skeleton className="h-24 w-full" />}
          {credits && credits.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
                <Ticket className="h-7 w-7 text-muted-foreground" />
                <p className="text-sm font-medium">No credits yet</p>
                <p className="text-xs text-muted-foreground">
                  If you ever cancel late, your fare lands here automatically.
                </p>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-3">
            {(credits || []).map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={styles[c.status] || ""}>
                        {c.status}
                      </Badge>
                      {c.status === "active" && (
                        <span className="text-xs text-muted-foreground">
                          expires in {daysUntil(c.expiresAt)} days ({fmtDate(c.expiresAt)})
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm">{c.note || "Travel credit"}</p>
                    <p className="text-xs text-muted-foreground">Issued {fmtDate(c.issuedAt)}</p>
                    {c.amount < c.initialAmount && c.status === "active" && (
                      <p className="mt-1 text-xs text-emerald-800">
                        {ksh(c.initialAmount - c.amount)} already used · {ksh(c.amount)} remaining
                      </p>
                    )}
                  </div>
                  <p className={`shrink-0 text-lg font-bold ${c.status === "active" ? "text-primary" : "text-muted-foreground"}`}>
                    {ksh(c.amount)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Ticket, Wallet } from "lucide-react";
import { Logo } from "@/components/logo";
import { useMe, api } from "@/lib/client";

export function SiteHeader() {
  const { me, refresh } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await api("/api/auth", { body: { step: "logout" } });
      await refresh();
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-primary">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" aria-label="Mi-Reli home">
          <Logo light />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <Link
            href="/"
            className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
              pathname === "/" ? "bg-primary-foreground/15 text-primary-foreground" : "text-primary-foreground/80 hover:text-primary-foreground"
            }`}
          >
            Book
          </Link>
          {me?.session && (
            <>
              <Link
                href="/bookings"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  pathname === "/bookings" ? "bg-primary-foreground/15 text-primary-foreground" : "text-primary-foreground/80 hover:text-primary-foreground"
                }`}
              >
                <Ticket className="h-4 w-4" />
                <span className="hidden sm:inline">My bookings</span>
              </Link>
              <Link
                href="/credits"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  pathname === "/credits" ? "bg-primary-foreground/15 text-primary-foreground" : "text-primary-foreground/80 hover:text-primary-foreground"
                }`}
              >
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">
                  Credit{me.creditBalance ? ` · KSh ${me.creditBalance}` : ""}
                </span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                disabled={busy}
                className="text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline ml-1">{me.session.name?.split(" ")[0]}</span>
              </Button>
            </>
          )}
          {!me?.session && (
            <Button size="sm" variant="secondary" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted-foreground">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold text-foreground">Mi-Reli</span> — reliable feeder rides
            connecting Mombasa Terminus (MTM) with the North &amp; South Coast, timed to every
            Madaraka Express.
          </p>
          <p className="text-xs">
            Fares collected via M-Pesa · Every shilling tracked in the platform ledger
          </p>
        </div>
      </div>
    </footer>
  );
}

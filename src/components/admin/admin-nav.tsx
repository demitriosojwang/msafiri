"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  CalendarCog,
  Car,
  ClipboardList,
  Coins,
  Radar,
  Receipt,
  Settings,
  Users,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/admin/trips", label: "Trips & Allocation", icon: Car },
  { href: "/admin/drivers", label: "Drivers", icon: Users },
  { href: "/admin/money", label: "Money & Ledger", icon: Coins },
  { href: "/admin/reconciliation", label: "Reconciliation", icon: Radar },
  { href: "/admin/config", label: "Config", icon: Settings },
  { href: "/admin/audit", label: "Audit log", icon: Receipt },
];

export function AdminNav({ adminName, adminEmail }: { adminName: string; adminEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await api("/api/admin/auth", { body: { step: "logout" } });
      router.push("/admin/login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex w-full flex-col border-r bg-primary text-primary-foreground lg:fixed lg:inset-y-0 lg:w-64">
      <div className="flex items-center justify-between px-4 py-4 lg:block">
        <Link href="/admin" aria-label="Mi-Reli admin">
          <Logo light size="sm" />
        </Link>
        <p className="mt-1 hidden text-xs text-primary-foreground/70 lg:block">Ops oversight console</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:mt-2 lg:flex-1 lg:flex-col lg:overflow-y-auto" aria-label="Admin">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary-foreground/15 text-primary-foreground"
                  : "text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden border-t border-primary-foreground/15 px-4 py-3 lg:block">
        <p className="text-sm font-medium">{adminName}</p>
        <p className="truncate text-xs text-primary-foreground/60">{adminEmail}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground"
          onClick={logout}
          disabled={busy}
        >
          Sign out
        </Button>
      </div>
    </aside>
  );
}

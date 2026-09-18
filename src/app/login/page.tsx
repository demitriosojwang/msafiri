"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginScreen } from "@/components/app/login-screen";
import { useMe } from "@/lib/client";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { refresh } = useMe();

  return (
    <LoginScreen
      onDone={() => {
        refresh();
        router.push(next || "/");
      }}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

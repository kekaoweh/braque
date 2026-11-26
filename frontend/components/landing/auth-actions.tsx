"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const primary =
  "inline-flex h-9 items-center gap-2 rounded-control bg-[linear-gradient(180deg,color-mix(in_srgb,var(--fg)_86%,white)_0%,var(--fg)_100%)] px-3.5 text-[13.5px] font-medium text-bg shadow-e2 transition-shadow hover:shadow-e3";

/** Header buttons: Sign in / Get started, or straight to the studio for someone already signed in. */
export function AuthActions() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    // A plain fetch: on the homepage, "not signed in" is an answer, not a reason to redirect.
    fetch("/api/auth/me", { credentials: "include" }).then((r) => setSignedIn(r.ok)).catch(() => {});
  }, []);
  if (signedIn)
    return (
      <Link href="/studio" className={primary}>
        Open your studio <ArrowRight className="size-4" strokeWidth={1.75} />
      </Link>
    );
  return (
    <div className="flex items-center gap-1.5">
      <Link href="/login" className="hidden h-9 items-center rounded-control px-3 text-[13.5px] font-medium text-muted transition-colors hover:bg-hover hover:text-fg sm:inline-flex">
        Sign in
      </Link>
      <Link href="/login?signup" className={primary}>Get started</Link>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info, X } from "@workspace/ui/icons";

const DISMISSED_KEY = "turbograph:guest-notice-dismissed";

/**
 * The guest rate-limit warning, as a corner toast rather than a band across the
 * page: it is context, not an error, so it should not push the repository down
 * the screen — and a reader who has read it once can close it for the session.
 */
export function GuestNotice({ loginHref }: { loginHref: string }) {
  // Starts hidden: rendering it before the stored dismissal is read flashes a
  // toast the reader already closed.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      // Storage blocked (private window, cookies off) — show it anyway.
    }
    setVisible(true);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Dismissal simply will not survive a reload.
    }
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white p-3.5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Viewing as guest
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            GitHub allows 60 requests an hour without an account.{" "}
            <Link
              href={loginHref}
              className="font-medium text-zinc-900 underline underline-offset-2 hover:no-underline dark:text-zinc-100"
            >
              Sign in
            </Link>{" "}
            for 5,000 an hour.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="-m-1 flex-shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

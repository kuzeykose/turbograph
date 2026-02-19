'use client';

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Github, ArrowRight } from "@workspace/ui/icons";

export function Header() {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-base font-semibold text-foreground">
            Turbograph
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/kuzeykose/turbograph"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="w-5 h-5" />
          </a>

          {!loading && (
            <>
              {user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
                >
                  Dashboard
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
                >
                  Sign in
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}

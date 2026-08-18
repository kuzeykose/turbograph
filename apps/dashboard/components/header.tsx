'use client';

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Github, ArrowRight } from "@workspace/ui/icons";
import { Button } from "@workspace/ui/components/button";
import { Logo } from "@/components/logo";
import { buildLoginUrl } from "@/lib/auth/redirect";

export function Header() {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Logo className="w-6 h-6" />
            Turbograph
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <a
              href="https://github.com/kuzeykose/turbograph"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="w-5 h-5" />
            </a>
          </Button>

          {!loading && (
            <>
              {user ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard">
                    Dashboard
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link href={buildLoginUrl()}>Sign in</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}

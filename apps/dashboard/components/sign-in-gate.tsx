"use client";

import Link from "next/link";
import { ArrowRight, Check, Github } from "@workspace/ui/icons";
import { signInPitchFor, type RepositoryTab } from "@/lib/repository-tabs";

/**
 * The gate a guest lands on when they open a tab that needs a session.
 *
 * Written as a preview rather than a wall: the sketch on the right is the shape
 * of the tab behind it, and the copy is what the reader gains, because this is
 * the only screen where the app gets to explain why an account is worth it.
 */
export function SignInGate({
  tab,
  loginHref,
}: {
  tab: RepositoryTab;
  loginHref: string;
}) {
  const pitch = signInPitchFor(tab);

  return (
    <div className="relative flex-1 min-h-0 overflow-auto">
      {/* Graph-paper ground, faded out at the edges so the panel floats on it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,rgba(113,113,122,0.22)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_60%_60%_at_center,black,transparent_75%)]"
      />

      <div className="relative flex min-h-full items-center justify-center p-6">
        {/* gap-px over a zinc ground draws the hairline between the halves. */}
        <div className="grid w-full max-w-3xl gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-800 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-white p-8 dark:bg-zinc-950">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 animate-in fade-in slide-in-from-bottom-1 duration-500 dark:text-zinc-500"
              style={{ animationDelay: "0ms" }}
            >
              {pitch.eyebrow}
            </p>

            <h2
              className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 animate-in fade-in slide-in-from-bottom-1 duration-500 dark:text-zinc-50"
              style={{ animationDelay: "60ms" }}
            >
              {pitch.title}
            </h2>

            <p
              className="mt-3 text-sm leading-relaxed text-zinc-500 animate-in fade-in slide-in-from-bottom-1 duration-500 dark:text-zinc-400"
              style={{ animationDelay: "120ms" }}
            >
              {pitch.body}
            </p>

            <ul className="mt-6 space-y-2.5">
              {pitch.perks.map((perk, i) => (
                <li
                  key={perk}
                  className="flex items-start gap-2.5 text-sm text-zinc-700 animate-in fade-in slide-in-from-bottom-1 duration-500 dark:text-zinc-300"
                  style={{ animationDelay: `${180 + i * 60}ms` }}
                >
                  <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100">
                    <Check className="h-2.5 w-2.5 text-white dark:text-zinc-900" />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>

            <Link
              href={loginHref}
              className="group mt-7 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors animate-in fade-in slide-in-from-bottom-1 duration-500 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              style={{ animationDelay: "360ms" }}
            >
              <Github className="h-4 w-4" />
              Sign in with GitHub
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <p
              className="mt-4 text-[11px] leading-relaxed text-zinc-400 animate-in fade-in duration-700 dark:text-zinc-500"
              style={{ animationDelay: "420ms" }}
            >
              Repository access is not granted at sign-in — you choose which
              repositories to connect afterwards.
            </p>
          </div>

          {/* The tab itself, sketched: what the reader is one click away from. */}
          <div className="relative hidden overflow-hidden bg-zinc-50 dark:bg-zinc-900/50 lg:block">
            <TabSketch tab={tab} />
            <span className="absolute bottom-4 left-5 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-600">
              Preview
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Faint line-art of each gated tab. Decorative — never announced to a reader. */
function TabSketch({ tab }: { tab: RepositoryTab }) {
  const shared =
    "absolute inset-0 h-full w-full text-zinc-300 dark:text-zinc-700 [mask-image:linear-gradient(to_bottom,black,transparent_92%)]";

  if (tab === "imports") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 240 260"
        fill="none"
        className={shared}
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="currentColor" strokeWidth="1">
          <path d="M120 62 L64 128 M120 62 L176 128 M64 128 L92 196 M64 128 L176 128 M176 128 L148 196 M92 196 L148 196" />
        </g>
        <g fill="currentColor">
          <circle cx="120" cy="62" r="9" />
          <circle cx="64" cy="128" r="7" />
          <circle cx="176" cy="128" r="7" />
          <circle cx="92" cy="196" r="5" />
          <circle cx="148" cy="196" r="5" />
        </g>
      </svg>
    );
  }

  if (tab === "files") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 240 260"
        fill="none"
        className={shared}
        preserveAspectRatio="xMidYMid slice"
      >
        <g fill="currentColor">
          {[0, 1, 2, 3, 4, 5, 6].map((row) => (
            <rect
              key={row}
              x={40 + (row % 3) * 12}
              y={56 + row * 22}
              width={row % 2 === 0 ? 76 : 58}
              height="6"
              rx="3"
            />
          ))}
        </g>
        <rect
          x="140"
          y="48"
          width="72"
          height="176"
          rx="6"
          stroke="currentColor"
          strokeWidth="1"
        />
        <g fill="currentColor" opacity="0.7">
          {[0, 1, 2, 3, 4, 5, 6].map((line) => (
            <rect
              key={line}
              x="152"
              y={66 + line * 20}
              width={line % 3 === 0 ? 44 : line % 3 === 1 ? 32 : 38}
              height="5"
              rx="2.5"
            />
          ))}
        </g>
      </svg>
    );
  }

  return (
    <svg
      aria-hidden
      viewBox="0 0 240 260"
      fill="none"
      className={shared}
      preserveAspectRatio="xMidYMid slice"
    >
      <g fill="currentColor">
        {[0, 1, 2, 3, 4, 5].map((line) => (
          <rect
            key={line}
            x="48"
            y={72 + line * 24}
            width={[128, 96, 144, 72, 116, 88][line]}
            height="6"
            rx="3"
            opacity={1 - line * 0.12}
          />
        ))}
      </g>
      <path
        d="M176 48 l5 13 13 5 -13 5 -5 13 -5 -13 -13 -5 13 -5 z"
        fill="currentColor"
      />
    </svg>
  );
}

import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const ogImageSize = { width: 1200, height: 630 } as const;
export const ogImageContentType = "image/png";

type OgImageOptions = {
  /** Small label above the headline, e.g. "Repository". */
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

const { from: BRAND_FROM, to: BRAND_TO } = siteConfig.brand;

function LogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient
          id="og-logo"
          x1="0"
          y1="0"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={BRAND_FROM} />
          <stop offset="100%" stopColor={BRAND_TO} />
        </linearGradient>
      </defs>
      <line
        x1="8"
        y1="6"
        x2="20"
        y2="10"
        stroke="url(#og-logo)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="6"
        x2="8"
        y2="18"
        stroke="url(#og-logo)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="20"
        y1="10"
        x2="20"
        y2="22"
        stroke="url(#og-logo)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="18"
        x2="20"
        y2="22"
        stroke="url(#og-logo)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="18"
        x2="20"
        y2="10"
        stroke="url(#og-logo)"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.35"
      />
      <circle cx="8" cy="6" r="3" fill="url(#og-logo)" />
      <circle cx="20" cy="10" r="3" fill="url(#og-logo)" />
      <circle cx="8" cy="18" r="3" fill="url(#og-logo)" />
      <circle cx="20" cy="22" r="3" fill="url(#og-logo)" />
    </svg>
  );
}

// A small layered dependency graph drawn behind the right side of the card.
const graphNodes = [
  { x: 120, y: 70, app: true },
  { x: 300, y: 70, app: true },
  { x: 60, y: 210, app: false },
  { x: 210, y: 210, app: false },
  { x: 360, y: 210, app: false },
  { x: 135, y: 350, app: false },
  { x: 285, y: 350, app: false },
];
const graphEdges: [number, number][] = [
  [0, 2],
  [0, 3],
  [1, 3],
  [1, 4],
  [2, 5],
  [3, 5],
  [3, 6],
  [4, 6],
];

function DecorativeGraph() {
  return (
    <svg width="440" height="420" viewBox="0 0 440 420" fill="none">
      <defs>
        <linearGradient
          id="og-edge"
          x1="0"
          y1="0"
          x2="440"
          y2="420"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={BRAND_FROM} />
          <stop offset="100%" stopColor={BRAND_TO} />
        </linearGradient>
      </defs>
      {graphEdges.map(([a, b]) => {
        const s = graphNodes[a]!;
        const t = graphNodes[b]!;
        return (
          <line
            key={`${a}-${b}`}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke="url(#og-edge)"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.55"
          />
        );
      })}
      {graphNodes.map((n, i) => (
        <g key={i}>
          <circle
            cx={n.x}
            cy={n.y}
            r="26"
            fill="#18181b"
            stroke={n.app ? BRAND_FROM : BRAND_TO}
            strokeWidth="3"
          />
          <circle
            cx={n.x}
            cy={n.y}
            r="9"
            fill={n.app ? BRAND_FROM : BRAND_TO}
          />
        </g>
      ))}
    </svg>
  );
}

/** Renders the 1200×630 social preview card shared by all routes. */
export function renderOgImage({ eyebrow, title, subtitle }: OgImageOptions) {
  const MAX_TITLE = 60;
  const displayTitle =
    title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1)}…` : title;
  const titleSize =
    displayTitle.length > 32 ? 52 : displayTitle.length > 20 ? 66 : 80;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: "#09090b",
        backgroundImage:
          "radial-gradient(circle at 85% 20%, rgba(139,92,246,0.28), transparent 45%), radial-gradient(circle at 70% 95%, rgba(45,212,191,0.22), transparent 45%)",
        color: "#fafafa",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 56,
          top: 105,
          display: "flex",
        }}
      >
        <DecorativeGraph />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          width: 740,
          height: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <LogoMark size={56} />
          <div
            style={{
              display: "flex",
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: -1,
            }}
          >
            {siteConfig.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {eyebrow ? (
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 3,
                color: BRAND_TO,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              wordBreak: "break-word",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                display: "flex",
                fontSize: 30,
                lineHeight: 1.35,
                color: "#a1a1aa",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 24,
            color: "#71717a",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid #27272a",
              backgroundColor: "#18181b",
              color: "#d4d4d8",
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            npx trbgraph
          </div>
          <div style={{ display: "flex", whiteSpace: "nowrap" }}>
            CLI · Web dashboard
          </div>
        </div>
      </div>
    </div>,
    { ...ogImageSize },
  );
}

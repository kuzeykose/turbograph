import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const { from, to } = siteConfig.brand;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#09090b",
      }}
    >
      <svg width="132" height="132" viewBox="0 0 28 28" fill="none">
        <defs>
          <linearGradient
            id="a"
            x1="0"
            y1="0"
            x2="28"
            y2="28"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <line
          x1="8"
          y1="6"
          x2="20"
          y2="10"
          stroke="url(#a)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="6"
          x2="8"
          y2="18"
          stroke="url(#a)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="20"
          y1="10"
          x2="20"
          y2="22"
          stroke="url(#a)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="18"
          x2="20"
          y2="22"
          stroke="url(#a)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="18"
          x2="20"
          y2="10"
          stroke="url(#a)"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.35"
        />
        <circle cx="8" cy="6" r="3" fill="url(#a)" />
        <circle cx="20" cy="10" r="3" fill="url(#a)" />
        <circle cx="8" cy="18" r="3" fill="url(#a)" />
        <circle cx="20" cy="22" r="3" fill="url(#a)" />
      </svg>
    </div>,
    { ...size },
  );
}

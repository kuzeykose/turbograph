import { renderOgImage, ogImageContentType, ogImageSize } from "@/lib/og-image";
import { siteConfig } from "@/lib/site";

export const alt = siteConfig.title;
export const size = ogImageSize;
export const contentType = ogImageContentType;

export default function OpengraphImage() {
  return renderOgImage({
    title: "Visualize your Turborepo workspace",
    subtitle:
      "Map every dependency and trace commit impact across your monorepo.",
  });
}

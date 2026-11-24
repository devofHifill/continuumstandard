import { siteMetadata } from "@/components/site/metadata";
import { SitePage } from "@/components/site/SitePage";

export const metadata = siteMetadata("platform");

/** Public site page (F6). */
export default function PlatformPage() {
  return <SitePage page="platform" />;
}

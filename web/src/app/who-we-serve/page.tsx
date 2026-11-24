import { siteMetadata } from "@/components/site/metadata";
import { SitePage } from "@/components/site/SitePage";

export const metadata = siteMetadata("who-we-serve");

/** Public site page (F6). */
export default function WhoWeServePage() {
  return <SitePage page="who-we-serve" />;
}

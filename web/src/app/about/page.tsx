import { siteMetadata } from "@/components/site/metadata";
import { SitePage } from "@/components/site/SitePage";

export const metadata = siteMetadata("about");

/** Public site page (F6). */
export default function AboutPage() {
  return <SitePage page="about" />;
}

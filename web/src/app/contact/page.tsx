import { siteMetadata } from "@/components/site/metadata";
import { SitePage } from "@/components/site/SitePage";

export const metadata = siteMetadata("contact");

/** Public site page (F6). */
export default function ContactPage() {
  return <SitePage page="contact" />;
}

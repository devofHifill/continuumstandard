import { siteMetadata } from "@/components/site/metadata";
import { SitePage } from "@/components/site/SitePage";

export const metadata = siteMetadata("terms");

/** Placeholder legal page (F6.7), in the public site's header and footer. */
export default function Page() {
  return <SitePage page="terms" />;
}

import { SITE_JSON_LD } from "@/components/site/markup.generated";
import { siteMetadata } from "@/components/site/metadata";
import { SitePage } from "@/components/site/SitePage";

export const metadata = siteMetadata("home");

/** Public home page (F6). */
export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD) }} />
      <SitePage page="home" />
    </>
  );
}

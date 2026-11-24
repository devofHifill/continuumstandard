import { siteMetadata } from "@/components/site/metadata";
import { SitePage } from "@/components/site/SitePage";

export const metadata = siteMetadata("training");

/** Public site page (F6). */
export default function TrainingPage() {
  return <SitePage page="training" />;
}

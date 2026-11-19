import type { Metadata } from "next";
import { ContentList } from "@/components/admin/ContentList";

export const metadata: Metadata = { title: "Training Content" };

export default function Page() {
  return <ContentList />;
}

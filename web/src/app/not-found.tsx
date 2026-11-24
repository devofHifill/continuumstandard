import type { Metadata } from "next";
import { ErrorScreen, LinkButton } from "@/components/shell/ErrorScreen";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

/** 404 for any address that doesn't exist (F7.1). */
export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="Page not found"
      actions={
        <>
          <LinkButton href="/" primary>
            Go to the home page
          </LinkButton>
          <LinkButton href="/login">Sign in</LinkButton>
        </>
      }
    >
      <p>The page you were looking for doesn&apos;t exist or has moved. Check the address, or use the links below.</p>
    </ErrorScreen>
  );
}

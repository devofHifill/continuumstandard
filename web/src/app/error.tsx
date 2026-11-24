"use client";

import { useEffect } from "react";
import { ErrorScreen, LinkButton } from "@/components/shell/ErrorScreen";
import { Button } from "@/components/ui";

/** Unexpected error on a public or sign-in page (F7.1). Signed-in pages have their own, inside the app shell. */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // Hook for an error-reporting service once the real backend exists.
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      code="Error"
      title="Something went wrong"
      actions={
        <>
          <Button onClick={() => retry()}>Try again</Button>
          <LinkButton href="/">Go to the home page</LinkButton>
        </>
      }
    >
      <p>An unexpected problem stopped this page from loading. Trying again usually fixes it.</p>
    </ErrorScreen>
  );
}

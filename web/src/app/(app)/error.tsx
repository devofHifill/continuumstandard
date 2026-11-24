"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/shell/ErrorScreen";
import { Button } from "@/components/ui";

/**
 * Unexpected error on a signed-in page (F7.1). It renders inside the app shell, so the
 * navigation stays and the learner or admin can carry on elsewhere.
 */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen code="Error" title="This page couldn't load" actions={<Button onClick={() => retry()}>Try again</Button>}>
      <p>
        Something unexpected went wrong. Your saved progress is safe — try again, or use the menu to go to another page.
      </p>
    </ErrorScreen>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui";

/** Centered card layout shared by the sign-in, forgot, reset and set-password pages. */
export function AuthCard({
  title,
  description,
  children,
  below,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  below?: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-12 pb-28 sm:items-center">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Link href="/" className="text-center text-sm font-semibold uppercase tracking-wide text-primary">
          The Continuum-Standard
        </Link>
        <Card>
          <CardBody className="flex flex-col gap-5 py-6">
            <div>
              <h1 className="font-display text-3xl font-normal tracking-tight text-primary">{title}</h1>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            {children}
          </CardBody>
        </Card>
        {below}
      </div>
    </main>
  );
}

export function FormAlert({ tone = "danger", children }: { tone?: "danger" | "success" | "info"; children: ReactNode }) {
  const tones = {
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
    info: "bg-info-soft text-info",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

import Link from "next/link";

/** Temporary home page. The public marketing website is built in F6. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">The Continuum-Standard</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Train the moments that matter most.</h1>
      <p className="max-w-xl text-lg text-muted">
        Scenario-based video training for behavioral-health teams. This is a development build — the public website
        arrives in phase F6.
      </p>
      <div>
        <Link
          href="/login"
          className="inline-flex h-12 items-center rounded-lg bg-primary px-6 font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}

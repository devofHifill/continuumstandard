"use client";

/**
 * Last-resort error page, used only if the root layout itself fails (F7.1). It replaces the
 * whole document, so it can't rely on the app's CSS or fonts — styles are inline.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6f1e7",
          color: "#22241f",
          fontFamily: "Georgia, serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <title>Something went wrong · The Continuum-Standard</title>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ color: "#17322a", fontWeight: 400, fontSize: 32 }}>Something went wrong</h1>
          <p style={{ color: "#51544d", fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
            The site couldn&apos;t load. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 12,
              padding: "10px 18px",
              border: 0,
              borderRadius: 8,
              background: "#17322a",
              color: "#f6f1e7",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

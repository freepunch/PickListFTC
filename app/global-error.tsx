"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "#09090b", color: "#e4e4e7", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "0.875rem", maxWidth: "24rem", marginBottom: "1.5rem" }}>
            An unexpected error occurred. Please try reloading the page.
          </p>
          <button
            onClick={reset}
            style={{ padding: "0.5rem 1.5rem", backgroundColor: "#3f3f46", color: "#e4e4e7", border: "1px solid #52525b", borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}

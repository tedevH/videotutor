"use client";

/** Last-resort screen when even the layout fails. Keeps the student's next step obvious. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fbfaf7", color: "#1c1b19", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5 }}>Something broke on our side.</h1>
          <p style={{ marginTop: 12, lineHeight: 1.6, opacity: 0.75 }}>
            Your work is saved. Try again, and if it keeps happening email support@lumotutor.com
            {error.digest ? ` with this code: ${error.digest}` : ""}.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 24, padding: "10px 20px", borderRadius: 10, border: "none", background: "#1c1b19", color: "white", fontSize: 15, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

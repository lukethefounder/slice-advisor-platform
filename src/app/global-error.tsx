"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Slice global error", {
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body style={{ margin: 0, background: "#030811", color: "#e9f6ff" }}>
        <title>Slice | Application interruption</title>
        <style>{`.slice-retry:focus-visible { outline: 2px solid #a99af4; outline-offset: 5px; }`}</style>
        <main
          style={{
            minHeight: "100vh",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background:
              "radial-gradient(circle at 15% 0%, rgba(112,227,210,.09), transparent 42%), radial-gradient(circle at 100% 100%, rgba(106,203,229,.06), transparent 40%), #030811",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          }}
        >
          <section
            role="alert"
            style={{
              width: "100%",
              boxSizing: "border-box",
              maxWidth: "680px",
              border: "1px solid #243c50",
              borderRadius: "24px",
              background: "linear-gradient(145deg, #0d1b2b, #09141f)",
              boxShadow: "0 32px 80px rgba(0,0,0,.42)",
              padding: "32px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  borderRadius: "13px 3px 13px 3px",
                  color: "#70e3d2",
                  fontSize: "28px",
                  fontWeight: 800,
                  background:
                    "linear-gradient(140deg, #123c3b, #09141f)",
                  border: "1px solid #36766c",
                }}
              >
                S
              </div>
              <div>
                <div style={{ fontSize: "25px", fontWeight: 750, letterSpacing: "-.055em" }}>Slice</div>
                <div
                  style={{
                    marginTop: "2px",
                    color: "#94a9bf",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: ".2em",
                    textTransform: "uppercase",
                  }}
                >
                  Advisor Intelligence Platform
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "36px",
                color: "#70e3d2",
                fontSize: "12px",
                fontWeight: 650,
                letterSpacing: ".18em",
                textTransform: "uppercase",
              }}
            >
              Application interruption
            </div>
            <h1
              style={{
                margin: "12px 0 0",
                fontSize: "clamp(32px, 6vw, 52px)",
                fontWeight: 600,
                lineHeight: 1.04,
                letterSpacing: "-.04em",
              }}
            >
              Slice could not complete this request.
            </h1>
            <p
              style={{
                margin: "18px 0 0",
                color: "#94a9bf",
                fontSize: "16px",
                lineHeight: 1.7,
              }}
            >
              Retry the application. If the problem continues, use the reference
              below when reviewing the server logs.
            </p>

            {error.digest ? (
              <div
                style={{
                  marginTop: "18px",
                  borderRadius: "12px",
                  background: "#0c1e2a",
                  border: "1px solid #243c50",
                  padding: "12px 14px",
                  color: "#94a9bf",
                  overflowWrap: "anywhere",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "12px",
                }}
              >
                Reference: {error.digest}
              </div>
            ) : null}

            <button
              type="button"
              className="slice-retry"
              onClick={reset}
              style={{
                minHeight: "46px",
                marginTop: "28px",
                border: "1px solid #9cf4e3",
                borderRadius: "10px",
                padding: "0 20px",
                color: "#042d2b",
                background: "#70e3d2",
                fontSize: "14px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              Retry Slice
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}

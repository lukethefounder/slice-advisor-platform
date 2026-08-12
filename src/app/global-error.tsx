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
    <html lang="en">
      <body style={{ margin: 0, background: "#020604", color: "#ffffff" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background:
              "radial-gradient(circle at 15% 0%, rgba(16,185,129,.18), transparent 32%), #020604",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: "680px",
              border: "1px solid rgba(110,231,183,.18)",
              borderRadius: "28px",
              background: "rgba(9,9,11,.92)",
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
                  borderRadius: "16px",
                  color: "#ffffff",
                  fontSize: "20px",
                  fontWeight: 900,
                  background:
                    "linear-gradient(135deg, #064e3b 0%, #09090b 48%, #059669 100%)",
                  border: "1px solid rgba(52,211,153,.35)",
                }}
              >
                S
              </div>
              <div>
                <div style={{ fontSize: "24px", fontWeight: 900 }}>Slice</div>
                <div
                  style={{
                    marginTop: "2px",
                    color: "#6ee7b7",
                    fontSize: "10px",
                    fontWeight: 900,
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
                color: "#6ee7b7",
                fontSize: "12px",
                fontWeight: 900,
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
                lineHeight: 1.04,
                letterSpacing: "-.04em",
              }}
            >
              Slice could not complete this request.
            </h1>
            <p
              style={{
                margin: "18px 0 0",
                color: "#cbd5e1",
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
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                  padding: "12px 14px",
                  color: "#94a3b8",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "12px",
                }}
              >
                Reference: {error.digest}
              </div>
            ) : null}

            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: "46px",
                marginTop: "28px",
                border: "1px solid rgba(52,211,153,.35)",
                borderRadius: "14px",
                padding: "0 20px",
                color: "#ffffff",
                background:
                  "linear-gradient(90deg, #10b981 0%, #047857 52%, #064e3b 100%)",
                fontSize: "14px",
                fontWeight: 900,
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
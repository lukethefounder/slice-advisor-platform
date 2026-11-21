"use client";

export default function MarketVisualsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section
      role="alert"
      style={{
        margin: "24px clamp(16px,3vw,40px)",
        padding: 32,
        border: "1px solid var(--slice-border,#243c50)",
        borderRadius: 20,
        background: "var(--slice-surface,#09141f)",
        color: "var(--slice-text,#c5d6e6)",
      }}
    >
      <h2 style={{ color: "var(--slice-heading,#e9f6ff)", fontWeight: 600 }}>
        Market Visuals could not finish loading.
      </h2>
      <p style={{ color: "var(--slice-muted,#94a9bf)", lineHeight: 1.8 }}>
        No placeholder observations were substituted. Retry the page without changing credentials or database settings.
      </p>
      <button
        type="button"
        onClick={reset}
        className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--slice-accent-strong)]"
        style={{
          minHeight: 44,
          marginTop: 16,
          padding: "12px 18px",
          borderRadius: 10,
          border: "1px solid var(--slice-primary-border,#9cf4e3)",
          background: "var(--slice-primary-bg,#70e3d2)",
          color: "var(--slice-primary-text,#042d2b)",
          fontWeight: 650,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </section>
  );
}

export default function WorkspaceLoading() {
  return (
    <section
      role="status"
      aria-live="polite"
      style={{
        margin: "24px clamp(16px,3vw,40px)",
        padding: 28,
        border: "1px solid var(--slice-border,#243c50)",
        borderRadius: 20,
        background: "var(--slice-surface-strong,#0d1b2b)",
        color: "var(--slice-muted,#94a9bf)",
      }}
    >
      <p style={{ margin: 0, fontSize: 12 }}>Opening your workspace…</p>
      <div
        aria-hidden="true"
        style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}
      >
        {[0, 1, 2].map((n) => (
          <div key={n} style={{ height: 72, borderRadius: 12, background: "var(--slice-surface-muted,#0c1e2a)" }} />
        ))}
      </div>
      <div
        aria-hidden="true"
        style={{ height: 230, borderRadius: 14, background: "var(--slice-surface-muted,#0c1e2a)", marginTop: 18 }}
      />
    </section>
  );
}

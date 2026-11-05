"use client";
export default function MarketVisualsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
 return <section role="alert" style={{ padding: 32, color: "var(--slice-text,#234b3d)" }}><h2>Market Visuals could not finish loading.</h2><p>No placeholder observations were substituted. Retry the page without changing credentials or database settings.</p><button onClick={reset} style={{ padding: "12px 18px", borderRadius: 12, border: "1px solid var(--slice-border,#ccdcd3)", cursor: "pointer" }}>Try again</button></section>;
}

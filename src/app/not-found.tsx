import { SystemStateScreen } from "@/components/system-state-screen";

export default function NotFound() {
  return (
    <SystemStateScreen
      eyebrow="Page not found"
      title="That Slice route is unavailable."
      description="The link may be outdated, the record may have moved, or your current role may not have access to this destination."
      primaryLabel="Return home"
      primaryHref="/"
      secondaryLabel="Founder login"
      secondaryHref="/founder-login"
    />
  );
}
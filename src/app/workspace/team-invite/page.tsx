import { redirect } from "next/navigation";
export default async function LegacyTeamInvitePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const code = typeof query.code === "string" ? query.code : "";
  redirect(`/team-invite${code ? `?code=${encodeURIComponent(code)}` : ""}`);
}

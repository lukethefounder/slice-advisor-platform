import { redirect } from "next/navigation";
import { queryString } from "@/lib/strategy-space/routes";
export default async function LegacyPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 redirect("/workspace/strategy-lab/scenarios" + queryString(await searchParams));
}

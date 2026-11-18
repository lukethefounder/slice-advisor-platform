import { redirect } from "next/navigation";
import { legacyStudioHref } from "@/lib/future-workspace/studio-route";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){redirect(legacyStudioHref(await searchParams,"live"));}

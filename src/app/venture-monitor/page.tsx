import { redirect } from "next/navigation";

export default function VentureMonitorRedirectPage() {
  redirect("/alternative-investments?view=venture");
}
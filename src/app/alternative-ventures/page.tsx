import { redirect } from "next/navigation";

export default function AlternativeVenturesRedirectPage() {
  redirect("/alternative-investments?view=venture");
}
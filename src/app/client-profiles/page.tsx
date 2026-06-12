import { redirect } from "next/navigation";

export default function ClientProfilesRedirectPage() {
  redirect("/workspace/clients");
}
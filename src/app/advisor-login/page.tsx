import { redirect } from "next/navigation";

export default function AdvisorLoginRedirect() {
  redirect("/workspace");
}
import { redirect } from "next/navigation";

export default function InvestorLoginRedirect() {
  redirect("/workspace");
}
import { redirect } from "next/navigation";

export default function CryptoMarketsRedirectPage() {
  redirect("/alternative-investments?view=crypto");
}
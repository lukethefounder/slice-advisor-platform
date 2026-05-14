import { redirect } from "next/navigation";

export default function PennyStocksRedirectPage() {
  redirect("/alternative-investments?view=penny-stocks");
}
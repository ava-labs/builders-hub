import { redirect } from "next/navigation";

export default function BuilderInsightsPage() {
  redirect("/profile?tab=insights");
}

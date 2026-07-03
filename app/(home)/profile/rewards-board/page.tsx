import { redirect } from "next/navigation";

export default function RewardsBoardPage() {
  redirect("/profile?tab=achievements");
}

import { redirect } from "next/navigation";

// Redirect to the main ICTT Setup page (which now shows the visual workbench)
export default function Page() {
  redirect("/console/ictt/setup");
}

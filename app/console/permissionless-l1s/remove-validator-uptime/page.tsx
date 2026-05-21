import { redirect, RedirectType } from "next/navigation";

export default function Page() {
  redirect("/console/remove-validator", RedirectType.replace);
}

import { redirect, RedirectType } from "next/navigation";

export default function Page() {
  redirect("/console/add-validator", RedirectType.replace);
}

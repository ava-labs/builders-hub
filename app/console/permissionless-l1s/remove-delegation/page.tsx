import { redirect } from "next/navigation";

export default function Page() {
    // Redirect to the first branch option (native) of the select-l1 step
    redirect("/console/permissionless-l1s/remove-delegation/native");
}

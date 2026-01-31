import { redirect } from "next/navigation";

export default function Page() {
    // Redirect to the first branch option (native) of the remove-validator step
    redirect("/console/permissionless-l1s/remove-validator/native");
}

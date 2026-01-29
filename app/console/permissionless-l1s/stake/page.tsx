import { redirect } from "next/navigation";

export default function Page() {
    // Redirect to the first branch option (native) of the stake step
    redirect("/console/permissionless-l1s/stake/native");
}

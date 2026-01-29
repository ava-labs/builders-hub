import { redirect } from "next/navigation";

export default function Page() {
    // Redirect to the first branch option (native-staking) of the deploy-staking-manager step
    redirect("/console/permissionless-l1s/staking-manager-setup/native-staking");
}

import TokenManagement from "@/components/toolbox/console/utilities/data-api-keys/TokenManagement";
import { getAuthSession } from "@/lib/auth/authSession";
import { redirect } from "next/navigation";
import { createGlacierJWT } from "@/lib/glacier-jwt";

export default async function Page() {
  const session = await getAuthSession();

  // If not authenticated, redirect to login
  if (!session) {
    redirect("/login?callbackUrl=/console/utilities/data-api-keys");
  }

  // Generate asymmetric JWT for Glacier API
  const glacierJwt = await createGlacierJWT({
    sub: session.user.id,
    iss: "https://build.avax.network/",
    email: session.user.email!,
  });

  // Pass authenticated user data to the component
  return (
    <TokenManagement
      glacierJwt={glacierJwt}
    />
  );
}

import DevnetFaucet from "@/components/toolbox/console/primary-network/DevnetFaucet";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/primary-network/devnet-faucet", "Devnet Faucet");

export default function Page() {
  return (
    <DevnetFaucet />
  );
}

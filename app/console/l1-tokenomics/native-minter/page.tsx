import NativeMinter from "@/components/toolbox/console/l1-tokenomics/NativeMinter";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/l1-tokenomics/native-minter");

export default function Page() {
  return (
    <NativeMinter />
  );
}

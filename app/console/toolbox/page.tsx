import ToolboxBoard from "@/components/toolbox/console/toolbox/ToolboxBoard";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/toolbox", "Toolbox");

export default function Page() {
  return <ToolboxBoard />;
}

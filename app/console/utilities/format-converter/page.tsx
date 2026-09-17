import FormatConverter from "@/components/toolbox/console/utilities/format-converter/FormatConverter";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/utilities/format-converter");

export default function Page() {
  return (
    <FormatConverter />
  );
}

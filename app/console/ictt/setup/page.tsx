import type { Metadata } from "next";
import { ICTTSetupClientPage } from "./client-page";

export const metadata: Metadata = {
  title: "ICTT Setup | Builder Console",
  description: "Visual bridge builder for Interchain Token Transfer. Connect your L1s with drag-and-drop simplicity.",
};

export default function Page() {
  return <ICTTSetupClientPage />;
}

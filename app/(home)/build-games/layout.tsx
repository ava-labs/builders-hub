import type { ReactNode } from "react";

export default function BuildGamesLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}

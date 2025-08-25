import * as LucideIcons from "lucide-react";

export function getLucideIcon(name: string, props?: any) {
  const Icon = (LucideIcons as any)[name];
  if (!Icon) return null;
  return <Icon {...props} />;
}

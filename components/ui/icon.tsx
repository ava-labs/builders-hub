import type { LucideIcon } from 'lucide-react';
import { TerminalIcon } from 'lucide-react';

export function create({
  icon: Icon,
}: {
  icon?: LucideIcon;
}): React.ReactElement {
  return (
    <div className="rounded-md border p-1 shadow-xs">
      {Icon ? <Icon /> : <TerminalIcon />}
    </div>
  );
}
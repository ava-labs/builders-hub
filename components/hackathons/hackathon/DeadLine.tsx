import { Hourglass } from "lucide-react";

export type Props = {
  deadline: Date;
};
export default function DeadLine({ deadline }: Props) {
  return (
    <div className="inline-flex items-center gap-3 rounded-md border-2 border-red-500 dark:bg-black px-3 py-2 text-zinc-50 h-10 justify-center w-fit md:justify-start whitespace-nowrap">
      <Hourglass className="h-3 md:h-5 w-3 md:w-5 dark:!text-zinc-50 !text-zinc-900" />
      <div className="flex flex-col">
        <span className="whitespace-nowrap text-zinc-900 dark:text-zinc-50 text-sm md:text-base">
          {(() => {
            const deadLineDate = new Date(deadline);
            const now = new Date();

            // Convertimos ambas fechas a UTC para evitar desajustes de zona horaria
            const diffMs = deadLineDate.getTime() - now.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(
              (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
            );
            const diffMinutes = Math.floor(
              (diffMs % (1000 * 60 * 60)) / (1000 * 60)
            );

            if (diffMs < 0) {
              return "Deadline has passed"; // Opcional: mensaje si la fecha ya pasó
            }

            if (diffDays > 0) {
              return `${diffDays}d ${diffHours}h to deadline`;
            } else {
              return `${diffHours}h ${diffMinutes}m to deadline`;
            }
          })()}
        </span>
      </div>
    </div>
  );
}

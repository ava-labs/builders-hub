import { ProjectPrice } from "@/types/showcase";
import { DynamicIcon } from "lucide-react/dynamic";

type Props = {
  prices: ProjectPrice[];
};
export default function Prices({ prices }: Props) {
  return (
    <div className="w-full md:h-[272px] bg-zinc-800 dark:bg-zinc-200 flex justify-center items-center py-4">
      <div className="w-full p-4 bg-zinc-300 dark:bg-zinc-700 flex flex-col sm:flex-row items-center sm:justify-center gap-4 sm:gap-2">
        {prices.map((price, index) => (
          <div
            key={index}
            className="flex-1 flex flex-col items-center justify-center"
          >
            <div className="p-2 bg-zinc-900 dark:bg-zinc-50 rounded-full">
              <DynamicIcon name={price.icon as any} size={20} className="!text-zinc-300 dark:!text-zinc-700" />
            </div>
            <div className="mt-2 sm:mt-4 flex flex-col justify-center">
              <h2 className="text-zinc-900 dark:text-zinc-50 text-2xl text-center font-bold">{price.title}</h2>
              <p className="text-zinc-900 dark:text-zinc-50 text-xs xl:text-sm text-center font-light xl:font-normal">{price.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

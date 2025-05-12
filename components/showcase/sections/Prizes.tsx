import { ProjectPrize } from "@/types/showcase";
import { DynamicIcon } from "lucide-react/dynamic";

type Props = {
  prizes: ProjectPrize[];
};
export default function Prices({ prizes }: Props) {
  return (
    <div className="relative left-1/2 right-1/2 h-[272px] -mx-[50vw] w-screen bg-zinc-800 dark:bg-zinc-200 py-4 flex justify-center items-center">


     <div className="px-6 py-4 rounded-2xl bg-zinc-300 dark:bg-zinc-700 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 max-w-fit">

        {prizes.map((prize, index) => (
          <div
            key={index}
            className="w-[210px] h-[176px] flex-1 flex flex-col items-center justify-center"
          >
            <div className="p-2 bg-zinc-900 dark:bg-zinc-50 rounded-full">
              <DynamicIcon name={prize.icon as any} size={20} className="!text-zinc-300 dark:!text-zinc-700" />
            </div>
            <div className="mt-2 sm:mt-4 flex flex-col justify-center">
              <h2 className="text-zinc-900 dark:text-zinc-50 text-2xl text-center font-bold">{prize.prize.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })}</h2>
              <p className="text-zinc-900 dark:text-zinc-50 text-xs xl:text-sm text-center font-light xl:font-normal">{prize.track}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

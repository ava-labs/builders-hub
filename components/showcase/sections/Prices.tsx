import { ProjectPrice } from "@/types/showcase";
import { DynamicIcon } from "lucide-react/dynamic";

type Props = {
  prices: ProjectPrice[];
};
export default function Prices({ prices }: Props) {
  return (
    <div className="w-full h-[272px] bg-zinc-200 flex justify-center items-center">
      <div className="w-[60%] xl:w-[55%] h-[176px] px-4 rounded-xl bg-zinc-700 flex items-center justify-center gap-2">
        {prices.map((price, index) => (
          <div
            key={index}
            className="flex-1 flex flex-col items-center justify-center"
          >
            <div className="p-2 bg-zinc-50 rounded-full">
              <DynamicIcon name="crown" size={20} color="#4F4F55" />
            </div>
            <div className="mt-4 flex flex-col justify-center">
              <h2 className="text-zinc-50 text-2xl text-center font-bold">{price.title}</h2>
              <p className="text-zinc-50 text-xs xl:text-sm text-center font-light xl:font-normal">{price.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

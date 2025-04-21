"use client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import AutoScroll from "embla-carousel-auto-scroll";
import { ProjectPrize } from "@/types/showcase";
import { DynamicIcon } from "lucide-react/dynamic";
import { useMemo } from "react";

type Props = {
  prizes: ProjectPrize[];
};
export default function Prices({ prizes }: Props) {
  const plugin = useMemo(
    () =>
      AutoScroll({
        speed: 1,
        stopOnInteraction: false,
        stopOnMouseEnter: false,
        playOnInit: true,
      }),
    []
  );
  return (
    <div className="relative h-[300px]">
      <div className="absolute w-screen left-1/2 transform -translate-x-1/2 h-[272px] bg-zinc-800 dark:bg-zinc-200 flex justify-center items-center py-8">
        <Carousel
          plugins={[plugin]}
          className="w-screen left-1/2 transform -translate-x-1/2 bg-zinc-300 dark:bg-zinc-700 py-4"
          opts={{
            loop: true,
            dragFree: false,
          }}
        >
          <CarouselContent>
            {prizes.map((prize, index) => (
              <CarouselItem
                key={index}
                className="basis-1/2 sm:basis-1/3 md:basis-1/5 items-center justify-center flex"
              >
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center justify-center"
                >
                  <div className="p-2 bg-zinc-900 dark:bg-zinc-50 rounded-full">
                    <DynamicIcon
                      name={prize.icon as any}
                      size={20}
                      className="!text-zinc-300 dark:!text-zinc-700"
                    />
                  </div>
                  <div className="mt-2 sm:mt-4 flex flex-col justify-center">
                    <h2 className="text-zinc-900 dark:text-zinc-50 text-2xl text-center font-bold">
                      {prize.price.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })}
                    </h2>
                    <p className="text-zinc-900 dark:text-zinc-50 text-xs xl:text-sm text-center font-light xl:font-normal">
                      {prize.track}
                    </p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </div>
  );
}

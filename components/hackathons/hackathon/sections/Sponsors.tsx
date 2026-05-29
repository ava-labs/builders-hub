"use client";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Separator } from "@/components/ui/separator";
import { SafeImage } from "@/components/common/SafeImage";
import { HackathonHeader } from "@/types/hackathons";
import AutoScroll from "embla-carousel-auto-scroll";
import Link from "next/link";
import { normalizeEventsLang, t } from "@/lib/events/i18n";
import { cn } from "@/lib/utils";

type SponsorsProps = {
  hackathon: HackathonHeader;
  /** Editor preview: strip stays within the panel width (no `vw`). Omitted on live pages. */
  isPreview?: boolean;
};

const stripSurfaceClass =
  "border-y border-zinc-200 bg-white dark:border-zinc-300/25 dark:bg-zinc-100";

function Sponsors({ hackathon, isPreview = false }: SponsorsProps) {
  const lang = normalizeEventsLang(hackathon.content?.language);
  const plugin = AutoScroll({
    speed: 1,
    stopOnInteraction: false,
    stopOnMouseEnter: false,
    playOnInit: true,
  });

  const partners = hackathon.content.partners;
  const useStaticRow = partners.length <= 5;

  return (
    <section className="min-w-0 w-full max-w-full">
      <h2 className="text-4xl font-bold mb-8" id="sponsors">
        {t(lang, "section.partners.title")}
      </h2>
      <Separator className="my-8 bg-zinc-300 dark:bg-zinc-800" />
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
        {t(lang, "section.partners.subtitle")}
      </p>
      <div
        className={cn(
          "min-w-0 overflow-hidden",
          !isPreview &&
            "relative left-1/2 w-screen max-w-none -translate-x-1/2",
          isPreview && "w-full max-w-full rounded-lg",
        )}
      >
        {useStaticRow ? (
          <div
            className={cn(
              "flex w-full flex-wrap items-center justify-around gap-6 px-4 py-4 sm:gap-8 sm:px-8",
              stripSurfaceClass,
              isPreview && "rounded-lg border-x",
            )}
          >
            {partners.map((partner, index) => (
              <div
                key={index}
                className="flex h-28 min-w-0 shrink-0 items-center justify-center"
              >
                <SafeImage
                  src={partner.logo}
                  alt={partner.name}
                  frameClassName="h-[100px] w-[160px] sm:w-[180px] max-w-full"
                  imageClassName="object-contain opacity-90 grayscale transition hover:opacity-100 hover:grayscale-0 dark:opacity-90 dark:hover:opacity-100"
                  fallbackIcon="image"
                />
              </div>
            ))}
          </div>
        ) : (
          <Carousel
            plugins={[plugin]}
            className={cn(
              "w-full py-4",
              stripSurfaceClass,
              isPreview && "rounded-lg border-x",
            )}
            opts={{
              loop: true,
              dragFree: false,
            }}
          >
            <CarouselContent>
              {partners.map((partner, index) => (
                <CarouselItem
                  key={index}
                  className="flex h-44 basis-[45%] items-center justify-center sm:basis-1/3 md:basis-1/4 lg:basis-1/5"
                >
                  <SafeImage
                    src={partner.logo}
                    alt={partner.name}
                    frameClassName="h-[100px] w-[140px] max-w-full sm:h-[120px] sm:w-[200px]"
                    imageClassName="object-contain opacity-90 grayscale transition hover:opacity-100 hover:grayscale-0 dark:opacity-90 dark:hover:opacity-100"
                    fallbackIcon="image"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        )}
      </div>
      <div className="flex justify-center mt-8">
        {hackathon.content.become_sponsor_link && (
          <Button
            variant={"secondary"}
            className="w-3/4 sm:w-1/2 lg:w-1/3 bg-red-500 rounded-md text-zinc-100"
          >
            <Link href={hackathon.content.become_sponsor_link}>
              {t(lang, "section.partners.becomeSponsor")}
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
export default Sponsors;

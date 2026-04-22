import { HackathonHeader } from "@/types/hackathons";
import React from "react";
import { normalizeEventsLang, t } from "@/lib/events/i18n";
import { SafeSpeakerPicture } from "@/components/hackathons/SafeSpeakerPicture";

function MentorsJudges({ hackathon }: { hackathon: HackathonHeader }) {
  const lang = normalizeEventsLang(hackathon.content?.language);
  // Don't render if no speakers
  if (!hackathon.content.speakers || hackathon.content.speakers.length === 0) {
    return null;
  }

  return (
    <section id="speakers">
      <div className="bg-zinc-900 p-14 flex flex-col gap-4">
        <div className="flex items-center justify-center text-center md:text-left md:justify-start flex-col md:flex-row ">
          <div className="lg:w-[45%] md:pr-16">
            <h2 className="text-4xl font-bold mb-8 text-zinc-100">
              {t(lang, "section.mentorsJudges.title")}
            </h2>
            {hackathon.content.speakers_text && (
              <p className="text-zinc-100">
                {hackathon.content.speakers_text}
              </p>
            )}
          </div>
            <div className="flex gap-10 justify-center sm:justify-start flex-wrap">
          {hackathon.content.speakers.map((speaker, index) => (
            <div key={index} className="flex flex-col gap-4 mt-4">
              <SafeSpeakerPicture
                src={speaker.picture}
                alt={t(lang, "section.mentorsJudges.speakerPictureAlt")}
              />
              <div>
                <h3 className="text-md font-bold text-zinc-100">
                  {speaker.name}
                </h3>
                <div className="flex items-center gap-2">
                  {/* <DynamicIcon
                    name={speaker.icon as any}
                    size={16}
                    color="#F5F5F9"
                  /> */}
                  <p className="text-sm font-light text-zinc-300">
                    {speaker.category}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      
      </div>
    </section>
  );
}
export default MentorsJudges;

'use client';

import React, { useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { NavigationMenu } from "@/components/hackathons/NavigationMenu";
import Schedule from "@/components/hackathons/hackathon/sections/Schedule";
import Tracks from "@/components/hackathons/hackathon/sections/Tracks";
import { AboutPreview } from "@/components/hackathons/hackathon/sections/About";
import Sponsors from "@/components/hackathons/hackathon/sections/Sponsors";
import Resources from "@/components/hackathons/hackathon/sections/Resources";
import Community from "@/components/hackathons/hackathon/sections/Community";
import MentorsJudges from "@/components/hackathons/hackathon/sections/MentorsJudges";
import OverviewBanner from "@/components/hackathons/hackathon/sections/OverviewBanner";
import JoinBannerLink from "@/components/hackathons/hackathon/JoinBannerLink";
import { normalizeEventsLang, t } from "@/lib/events/i18n";
import StagesSection from './hackathon/sections/StagesSection';

// Simple client-compatible Submission component for preview
const SubmissionPreview = ({ hackathon }: { hackathon: any }) => {
  return (
    <section className='py-16 text-black dark:text-white'>
      <h2 className='text-4xl font-bold' id='submission'>
        Submit Your Project
      </h2>
      <div className='my-8 h-px bg-zinc-300 dark:bg-zinc-800'></div>
      <p className='text-lg mb-8'>
        Follow the guidelines to submit your hackathon project successfully
      </p>

      <div className='grid grid-cols-1 lg:grid-cols-4'>
        <div className='bg-zinc-200 dark:bg-zinc-900 p-6 shadow-md flex flex-col items-start justify-center rounded-tl-md rounded-tr-md lg:rounded-tr-none rounded-bl-md'>
          <div className='mb-4 text-zinc-600 dark:text-zinc-400 text-2xl'>📅</div>
          <h3 className='text-xl font-semibold mb-2'>Deadline</h3>
          <p className='text-sm'>
            {hackathon.content?.submission_deadline
              ? `Submissions close on ${new Date(hackathon.content.submission_deadline).toLocaleDateString()}`
              : 'Deadline TBD'
            }
          </p>
        </div>

        <div className='bg-zinc-700 dark:bg-zinc-800 p-6 shadow-md flex flex-col items-start justify-center'>
          <div className='mb-4 text-zinc-200 dark:text-zinc-400 text-2xl'>✅</div>
          <h3 className='text-xl font-semibold mb-2 text-zinc-50'>
            Requirements
          </h3>
          <p className='text-sm text-zinc-50'>
            Your project must include a GitHub repo, slides for your pitch, and any additional content.
          </p>
        </div>

        <div className='bg-zinc-200 dark:bg-zinc-900 p-6 shadow-md flex flex-col items-start justify-center'>
          <div className='mb-4 text-zinc-600 dark:text-zinc-400 text-2xl'>🏆</div>
          <h3 className='text-xl font-semibold mb-2'>Evaluation Criteria</h3>
          <p className='text-sm'>
            Projects will be judged on value proposition, technical complexity
            and usage of Avalanche technologies
          </p>
        </div>

        <div className='bg-zinc-700 dark:bg-zinc-800 p-6 shadow-md flex flex-col items-start justify-center lg:rounded-tr-md rounded-bl-md lg:rounded-bl-none rounded-br-md'>
          <div className='mb-4 text-zinc-200 dark:text-zinc-400 text-2xl'>🚀</div>
          <h3 className='text-xl font-semibold mb-2 text-zinc-50'>
            Submission Process
          </h3>
          <p className='text-sm text-zinc-50'>
            Submit your project through the Avalanche Builder Hub, add your
            team members, and upload your GitHub repo, presentation slides along with any other file that support your submission.
          </p>
        </div>
      </div>

      <div className='flex justify-center mt-8 gap-4'>
        <button className='w-2/5 md:w-1/3 lg:w-1/4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded cursor-pointer'>
          View full guidelines
        </button>
        <button className='w-2/5 md:w-1/3 lg:w-1/4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded cursor-pointer'>
          Submit project
        </button>
      </div>
    </section>
  );
};

export interface HackathonPreviewProps {
  hackathonData: {
    id?: string;
    title: string;
    description: string;
    location: string;
    total_prizes: number;
    tags: string[];
    participants?: number;
    organizers?: string;
    banner?: string;
    is_public?: boolean;
    content: {
      language?: "en" | "es";
      tracks_text?: string;
      tracks?: any[];
      schedule?: any[];
      speakers?: any[];
      speakers_text?: string;
      resources?: any[];
      partners?: string[];
      join_custom_link?: string;
      join_custom_text?: string;
      submission_custom_link?: string;
      judging_guidelines?: string;
      submission_deadline?: string;
      registration_deadline?: string;
      stages: any
    };
    start_date?: string;
    end_date?: string;
    status?: string;
  };
  is_public?: boolean;
  isRegistered?: boolean;
  scrollTarget?: string; // New prop for scroll target
}

export default function HackathonPreview({ hackathonData, isRegistered = false, scrollTarget }: HackathonPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const lang = normalizeEventsLang(hackathonData.content?.language);
  // Scroll to specific section when scrollTarget changes
  useEffect(() => {
    if (scrollTarget && previewRef.current) {
      const targetElement = previewRef.current.querySelector(`#${scrollTarget}`);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }
    }
  }, [scrollTarget]);
  // Transform the form data into the format expected by the hackathon components
  const transformedHackathon = {
    id: hackathonData.id || 'preview',
    title: hackathonData.title || 'Your Hackathon Title',
    description: hackathonData.description || 'Enter your hackathon description to see it here...',
    location: hackathonData.location || 'Online',
    total_prizes: hackathonData.total_prizes || 0,
    tags: hackathonData.tags || [],
    banner: hackathonData.banner || "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/main_banner_img-crBsoLT7R07pdstPKvRQkH65yAbpFX.png",
    participants: hackathonData.participants || 0,
    organizers: hackathonData.organizers || '',
    small_banner: '',
    icon: '',
    timezone: 'UTC',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    top_most: false,
    custom_link: undefined,
    created_by: '',
    cohosts: [],
    is_public: hackathonData.is_public ?? true,
    content: {
      language: hackathonData.content?.language,
      tracks_text: hackathonData.content?.tracks_text || '',
      tracks: hackathonData.content?.tracks || [],
      schedule: hackathonData.content?.schedule || [],
      speakers: hackathonData.content?.speakers || [],
      resources: hackathonData.content?.resources || [],
      partners: (hackathonData.content?.partners || []).map((partner: any) =>
        typeof partner === 'string'
          ? { name: partner, about: '', links: [] }
          : partner
      ),
      join_custom_link: hackathonData.content?.join_custom_link || '',
      join_custom_text: hackathonData.content?.join_custom_text || 'Join now',
      submission_custom_link: hackathonData.content?.submission_custom_link || '',
      judging_guidelines: hackathonData.content?.judging_guidelines || '',
      submission_deadline: hackathonData.content?.submission_deadline ? new Date(hackathonData.content.submission_deadline) : new Date(),
      registration_deadline: hackathonData.content?.registration_deadline ? new Date(hackathonData.content.registration_deadline) : new Date(),
      address: '',
      become_sponsor_link: '',
      mentors_judges_img_url: '',
      speakers_text: '',
      speakers_banner: '',
      stages: hackathonData.content?.stages
    },
    start_date: hackathonData.start_date || '',
    end_date: hackathonData.end_date || '',
    status: (hackathonData.status || 'UPCOMING') as 'ENDED' | 'ONGOING' | 'UPCOMING',
  };

  const menuItems = [
    { name: t(lang, "menu.about"), ref: "about" },
    { name: t(lang, "menu.tracks"), ref: "tracks" },
    { name: t(lang, "menu.resources"), ref: "resources" },
    { name: t(lang, "menu.schedule"), ref: "schedule" },
    { name: t(lang, "menu.submission"), ref: "submission" },
    { name: t(lang, "menu.mentorsJudges"), ref: "speakers" },
    // { name: "Partners", ref: "sponsors" }, // Hidden
  ];

  // Check if we have meaningful data to show
  const hasData = hackathonData.title || hackathonData.description || hackathonData.location;

  return (
    <div ref={previewRef} className="h-full overflow-y-auto bg-white dark:bg-zinc-900">
      <div className="container sm:px-2 py-4 lg:py-16">
        {!hasData && (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-zinc-600 dark:text-zinc-400 mb-4">
                Live Preview
              </h2>
              <p className="text-zinc-500 dark:text-zinc-500">
                Start editing a hackathon to see the live preview here
              </p>
            </div>
          </div>
        )}
        {hasData && (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {transformedHackathon.title}
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                  {transformedHackathon.description}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  ${transformedHackathon.total_prizes.toLocaleString()} in prizes
                </span>
                <Button className="bg-red-500 hover:bg-red-600 text-white">
                  {t(lang, "join.default")}
                </Button>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="mb-6">
              <NavigationMenu items={menuItems} />
            </div>

            {/* Main Content */}
            <div className="flex flex-col mt-2">
              <div className="sm:px-8 pt-6">
                <div className="sm:block relative w-full">
                  <OverviewBanner
                    hackathon={transformedHackathon}
                    id={transformedHackathon.id}
                    isTopMost={false}
                    isRegistered={isRegistered}
                    utm=""
                    isPreview={true}
                  />
                  <JoinBannerLink
                    isRegistered={isRegistered}
                    hackathonId={transformedHackathon.id}
                    customLink={transformedHackathon.content.join_custom_link}
                    bannerSrc={transformedHackathon.banner}
                    altText="Hackathon background"
                    utm=""
                  />
                </div>

                <div className="py-8 sm:p-8 flex flex-col gap-20">
                  {
                    transformedHackathon.content.stages && transformedHackathon.content.stages.length > 0 && (
                      <StagesSection stages={transformedHackathon.content.stages} hackathon={transformedHackathon} renderInPreview={true} />
                    )
                  }
                  {transformedHackathon.content.tracks_text && (
                    <AboutPreview hackathon={transformedHackathon} />
                  )}
                  {transformedHackathon.content.tracks && transformedHackathon.content.tracks.length > 0 && (
                    <Tracks hackathon={transformedHackathon} />
                  )}
                  <Resources hackathon={transformedHackathon} />
                  <Schedule
                    hackathon={transformedHackathon}
                    scheduleSource="database"
                  />
                  <SubmissionPreview hackathon={transformedHackathon} />
                  {transformedHackathon.content.speakers && transformedHackathon.content.speakers.length > 0 && (
                    <MentorsJudges hackathon={transformedHackathon} />
                  )}
                  <Community hackathon={transformedHackathon} />
                  {/* Partners section hidden */}
                  {/* {transformedHackathon.content.partners?.length > 0 && (
                <Sponsors hackathon={transformedHackathon} />
              )} */}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

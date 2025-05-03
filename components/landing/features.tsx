"use client";

import React from "react";
import {
  GraduationCap,
  Ticket,
  Speech
} from "lucide-react";
import { cn } from "@/utils/cn";
import Link from "next/link";

const features = [
  {
    id: 1,
    label: "Academy",
    title: "Start <strong>Learning</strong>.",
    description:
      "Enroll in our free online courses to learn about Avalanche and earn certificates.",
    icon: GraduationCap,
    href: "/academy"
  },
  {
    id: 2,
    label: "Hackathons",
    title: "Register for our <strong>Hackathons</strong>.",
    description:
      "Find out about upcoming hackathons and events, and learn how to get involved.",
    icon: Ticket,
    href: "/hackathons"
  },
  {
    id: 3,
    label: "Connect",
    title: "Connect with <strong>other Students</strong>.",
    description:
      "Join our Telegram chat with other students and Avalanche experts.",
    icon: Speech,
    href: "https://t.me/avalancheacademy"
  }
];

export default function Features() {
  return (
    <div className="flex flex-col justify-center items-center px-4 mb-16">
      <h2 className="font-display text-3xl tracking-tight sm:text-5xl text-center">
        Learn about Avalanche
      </h2>
      <p className="mt-4 text-lg tracking-tight text-zinc-400 text-center">
        Find the learning resources you need to get started with Avalanche, from online courses and hackathons.
      </p>
      <div className="mt-10 mx-auto font-geist relative md:border-l-0 md:border-b-0 md:border-[1.2px] rounded-none -pr-2">
        <div className="w-full md:mx-0">
          <div className="grid grid-cols-1 relative md:grid-rows-1 md:grid-cols-3 border-b-[1.2px]">

            {features.map((feature, index) => (
              <Link
                key={feature.id}
                href={feature.href}
                className={cn(
                  "group block border-l-[1.2px] border-r-[1.2px] md:border-r-0 md:min-h-[240px] border-t-[1.2px] md:border-t-0 transform-gpu hover:bg-[#dfe3e8] dark:hover:bg-[#1c1c1c]",
                  index >= 3 && "md:border-t-[1.2px]",
                  "transition-all duration-300 ease-in-out"
                )}
              >
                <div className="flex flex-col p-10 h-full">
                  <div className="flex items-center gap-2 my-1">
                    <feature.icon className="w-4 h-4 transition-transform group-hover:scale-110 group-hover:text-gray-800 dark:group-hover:text-zinc-300" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {feature.label}
                    </p>
                  </div>
                  <div className="mt-2">
                    <div className="max-w-full">
                      <div className="flex gap-3">
                        <p
                          className="max-w-lg text-xl font-normal tracking-tighter md:text-2xl"
                          dangerouslySetInnerHTML={{
                            __html: feature.title,
                          }}
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-left text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                  <div className="text-gray-700 dark:text-zinc-300 group-hover:text-gray-900 dark:group-hover:text-white mt-4 inline-flex items-center transition-colors">
                    Learn more
                    <svg
                      className="w-4 h-4 ml-1 transform transition-transform group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
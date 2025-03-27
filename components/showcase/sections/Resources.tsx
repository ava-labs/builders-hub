import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProjectResource } from "@/types/showcase";
import { DynamicIcon } from "lucide-react/dynamic";
import React from "react";

type Props = {
  resources: ProjectResource[];
};

export default function Resources({ resources }: Props) {
  return (
    <section className="text-black dark:text-white py-12">
      <h2 className="text-2xl font-bold mb-6">Project Resources</h2>
      <Separator className="my-8 bg-zinc-300 dark:bg-zinc-800" />
      <p className="text-lg mb-6">
        Explore key links to learn more, connect with the team, and access
        essential resources.
      </p>

      <div className="flex flex-col items-center md:flex-row justify-center gap-4">
        {resources.map((item, index) => (
          <a
            key={index}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-[80px]"
          >
            <Card
              className="border border-gray-300 dark:border-gray-800 hover:border-gray-500 dark:hover:border-gray-600 transition 
                         flex items-center justify-start md:justify-center gap-3 w-full h-full 
                         rounded-lg px-6 py-4 "
            >
              <div className="p-3 flex items-center justify-center bg-[#FF394A] rounded-full text-zinc-50">
                <DynamicIcon
                  name={item.icon as any}
                  color="#F5F5F9"
                  className="w-5 sm:w-7 h-5 sm:h-7"
                />
              </div>
              <h3 className="text-black dark:text-white sm:text-lg font-semibold">
                {item.title}
              </h3>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
}

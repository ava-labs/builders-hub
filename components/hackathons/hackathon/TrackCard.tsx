import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Track } from "@/types/hackathons";
import { DynamicIcon } from "lucide-react/dynamic";
import React from "react";

type Props = {
  track: Track;
};

export default function TrackCard(props: Props) {
  const highlighted = props.track.partner?.includes("Avalanche");
  return (
    <Card
      className={`min-h-40 h-full bg-zinc-50 dark:bg-zinc-900 cursor-pointer rounded-xl ${
        highlighted ? "border-2 border-red-500" : ""
      }`}
    >
      <CardHeader>
        <CardTitle>
          <div className="flex justify-between items-center gap-2">
            <h2
              className={`${
                highlighted ? "text-red-500" : "text-zinc-900 dark:text-zinc-50"
              } text-xl font-bold`}
            >
              {props.track.name}
            </h2>
            <DynamicIcon
              name={props.track.icon as any}
              size={16}
              className={
                highlighted
                  ? "!text-red-500"
                  : `dark:!text-zinc-400 !text-zinc-600`
              }
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="dark:bg-zinc-900 bg-zinc-50">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 text-left">
          {props.track.short_description}
        </p>
      </CardContent>
    </Card>
  );
}

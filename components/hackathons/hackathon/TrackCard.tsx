import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Track } from "@/types/hackathons";
import { DynamicIcon } from "lucide-react/dynamic";
import React from "react";

type Props = {
  track: Track;
};

export default function TrackCard(props: Props) {
  return (
    <Card
      className={`min-h-48 h-full bg-zinc-900 dark:bg-zinc-900 cursor-pointer rounded-lg border-2 border-red-500 hover:shadow-lg transition-shadow duration-200`}
    >
      <CardHeader className="pb-3">
        <CardTitle>
          <div className="flex justify-between items-center gap-2">
            <h2 className="text-red-500 text-lg font-bold">
              {props.track.name}
            </h2>
            {props.track.icon && props.track.icon.trim() !== "" ? (
              <DynamicIcon
                name={props.track.icon as any}
                size={20}
                className="!text-red-500"
              />
            ) : (
              <DynamicIcon
                name="wrench"
                size={20}
                className="!text-red-500"
              />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-white text-left leading-relaxed">
          {props.track.short_description || 'No description available'}
        </p>
      </CardContent>
    </Card>
  );
}

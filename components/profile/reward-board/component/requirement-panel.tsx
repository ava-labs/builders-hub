import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check } from "lucide-react";

type Requirement = {
  id: string | number;
  description: string;
  points?: number;
  unlocked?: boolean;
};

export function RequirementsPanel({
  requirements = [],
  title 
}: {
  requirements?: Requirement[];
  title?: string;
}) {
  // COMMENTED OUT: Points feature disabled
  // const total = requirements.reduce(
  //   (acc, r) => acc + Number(r.points ?? 0),
  //   0
  // );

  return (
    <div >
      <Card className="h-full dark:bg-zinc-600 shadow-none ">

    
        <CardContent className="p-0 h-full flex flex-col">
        <CardTitle className="text-center text-lg font-semibold dark:text-white text-gray-900 ">
          {title}
        </CardTitle>

          <div className="px-6 pt-6 pb-2">
            <h3 className="text-base  font-semibold dark:text-white text-gray-900 ">
              Requirements
            </h3>
          </div>

          <div className="px-6 pb-6 ">
            <ul className="text-left ">
              {requirements.map((requirement) => (
                <li
                  key={requirement.id}
                  className="flex items-start space-x-3 text-sm text-gray-700 dark:text-gray-300 pt-2"
                >


                  <span
                    className="leading-relaxed flex items-center"
                    title={requirement.description}
                  >
                    {(requirement.unlocked) && (
                      <Check className="w-10 h-10 text-green-500 mr-2" />
                    )}
                    <span>
                      {requirement.description}
                      {/* COMMENTED OUT: Points feature disabled */}
                      {/* :{" "}
                      <span className="font-bold">
                        {Number(requirement.points ?? 0)} points
                      </span> */}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {/* COMMENTED OUT: Points feature disabled */}
            {/* <Separator className="bg-zinc-700 my-2" />

            <span className="font-bold">{total} points</span> */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

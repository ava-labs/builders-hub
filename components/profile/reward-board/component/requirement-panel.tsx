import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Requirement = {
  id: string | number;
  description: string;
  points?: number;
  unlocked?: boolean;
};

export function RequirementsPanel({
  requirements = [],
}: {
  requirements?: Requirement[];
}) {
  const total = requirements.reduce(
    (acc, r) => acc + Number(r.points ?? 0),
    0
  );

  return (
    <div >
      <Card className="h-full border border-zinc-700 shadow-none bg-transparent">
        <CardContent className="p-0 h-full flex flex-col">
          <div className="px-6 pt-6 pb-2">
            <h3 className="text-base text-center font-semibold dark:text-white text-gray-900 mb-4">
              Requirements
            </h3>
          </div>

          <div className="px-6 pb-6 h-35 overflow-y-auto">
            <ul className="text-left ">
              {requirements.map((requirement) => (
                <li
                  key={requirement.id}
                  className="flex items-start space-x-3 text-sm text-gray-700 dark:text-gray-300"
                >
                  <span className="flex-shrink-0 w-2 h-2 bg-gradient-to-r from-red-500 to-zinc-700 rounded-full mt-2"></span>

                  <span
                    className="leading-relaxed"
                    style={{
                      textDecoration: requirement.unlocked ? "line-through" : "none",
                    }}
                    title={requirement.description}
                  >
                    {requirement.description}:{" "}
                    <span className="font-bold">
                      {Number(requirement.points ?? 0)} points
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <Separator className="bg-zinc-700 my-2" />

            <span className="font-bold">{total} points</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

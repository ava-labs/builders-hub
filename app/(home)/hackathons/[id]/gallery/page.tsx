import { redirect } from "next/navigation";
import { getHackathon } from "@/server/services/hackathons";
import { getProjectsForGallery } from "@/server/services/projects";
import { PublicGalleryView } from "@/components/gallery/PublicGalleryView";

type GallerySearchParams = {
  search?: string;
  track?: string | string[];
  stack?: string | string[];
  country?: string | string[];
  team_type?: string;
  sort?: string;
  cursor?: string;
};

const toArray = (v: string | string[] | undefined): string[] => {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
};

export default async function HackathonGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<GallerySearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const hackathon = await getHackathon(id);
  if (!hackathon) redirect("/hackathons");

  const tracks = toArray(sp.track);
  const stack = toArray(sp.stack);
  const country = toArray(sp.country);
  const teamType =
    sp.team_type === "solo" || sp.team_type === "duo" ? sp.team_type : undefined;
  const sort =
    sp.sort === "oldest" || sp.sort === "name" ? sp.sort : "newest";

  // Per-event filters: we apply the first track as the legacy SQL filter and
  // OR-aggregate stack via the new column. Country/team_type/sort handled by
  // getProjectsForGallery directly.
  const { projects, next_cursor } = await getProjectsForGallery({
    event: id,
    search: sp.search?.trim() || undefined,
    track: tracks[0],
    stack: stack.length > 0 ? stack : undefined,
    country: country.length > 0 ? country : undefined,
    teamType,
    sort,
    cursor: sp.cursor,
    limit: 24,
  });

  const availableTracks = (hackathon.content?.tracks ?? []).map((t: { name: string }) => t.name);
  const availableStackOptions = hackathon.content?.tech_stack_options ?? [];

  return (
    <PublicGalleryView
      hackathonId={id}
      hackathonTitle={hackathon.title}
      projects={projects}
      nextCursor={next_cursor}
      availableTracks={availableTracks}
      availableStackOptions={availableStackOptions}
      initialFilters={{
        search: sp.search,
        tracks,
        stack,
        country,
        teamType: teamType ?? "",
        sort,
      }}
    />
  );
}

import { permanentRedirect } from "next/navigation";
import PlaygroundPage from "./_components/PlaygroundPage";

/* Playground gave way to Query: ask in plain words, pin the charts to a
   board. A saved dashboard (?id=) still opens, since profiles link to it;
   a blank Playground lands on Query. */
export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  if (!id) permanentRedirect("/explorer/mainnet/query");
  return <PlaygroundPage />;
}

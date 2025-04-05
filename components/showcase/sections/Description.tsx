import { Separator } from "@/components/ui/separator";
import { MDXRemote } from "next-mdx-remote/rsc";

type Props = {
  description: string;
};
export default function Description({ description }: Props) {
  return (
    <div>
      <h1 className="text-2xl">Full Description</h1>
      <Separator className="my-4 bg-zinc-300 dark:bg-zinc-800" />
      <MDXRemote source={description} />
    </div>
  );
}

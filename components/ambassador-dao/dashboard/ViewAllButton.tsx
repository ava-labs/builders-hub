import { ArrowRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const ViewAllButton = ({ type }: { type: string }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasQueryParam = searchParams.has("type");

  const handleViewAll = () => {
    if (!hasQueryParam) {
      const params = new URLSearchParams(searchParams);
      params.set("type", type);
      const url = `${pathname}?${params.toString()}`;
      router.push(url);
    }
  };

  return (
    !hasQueryParam && (
      <button
        className='inline-flex gap-x-2'
        onClick={handleViewAll}
      >
        Show All
        <ArrowRight size={20} color="var(--white-text-color)" />
      </button>
    )
  );
};

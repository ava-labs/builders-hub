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
          className="w-full bg-red-500 hover:bg-red-600 text-white rounded-md py-3 font-medium mt-6"
          onClick={handleViewAll}
        >
          VIEW ALL
        </button>
      )
    );
  };
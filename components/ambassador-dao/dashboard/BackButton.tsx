import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const GoBackButton = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");

  const handleGoBack = () => {
    router.push(pathname);
  };

  if (!type) return null;

  return (
    <p
      className='flex items-center justify-center rounded-md gap-2 py-4 cursor-pointer w-[121px] h-10 mb-8 border border-[var(--default-border-color)]'
      onClick={handleGoBack}
    >
      <ArrowLeft color='var(--white-text-color)' size={16} />
      Go Back
    </p>
  );
};

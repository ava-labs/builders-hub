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
      <p className="flex gap-2 py-4 cursor-pointer" onClick={handleGoBack}>
        <ArrowLeft color="#fff" />
        Go Back
      </p>
    );
  };
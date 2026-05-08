import { LegacyBanner } from "@/components/toolbox/console/ictt/bridge/LegacyBanner";

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4">
            <LegacyBanner />
            {children}
        </div>
    );
}

import IcttBridgeClientPage from "./client-page";

type SearchParams = { phase?: string; remote?: string };

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const { phase, remote } = await searchParams;
    return <IcttBridgeClientPage initialPhase={phase} initialRemote={remote} />;
}

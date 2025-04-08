'use client'
import L1Launcher from "../../../../toolbox/src/l1-launcher/L1Launcher"
import dynamic from 'next/dynamic';


const L1LauncherNoSSR = dynamic(() => Promise.resolve(L1Launcher), {
    ssr: false,
});


export default function L1LauncherPage() {
    return (
        <div className="">
            <L1LauncherNoSSR />
        </div>
    );
}

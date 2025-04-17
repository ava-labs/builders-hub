"use client";

import { Suspense } from "react";
import Steps from "../components/Steps";
import ToolHeader from "../components/ToolHeader";
import { stepGroups, stepList } from "./stepList";
import { useL1LauncherStore } from "./L1LauncherStore";
import { Button } from "../components/Button";
import { ConnectWallet } from "../components/ConnectWallet";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../components/ErrorFallback";

export default function L1Launcher() {
    const stepsCurrentStep = useL1LauncherStore(state => state.stepsCurrentStep);
    const stepsMaxStep = useL1LauncherStore(state => state.stepsMaxStep);
    const setStepsCurrentStep = useL1LauncherStore(state => state.setStepsCurrentStep);
    const reset = useL1LauncherStore(state => state.reset);

    return <>
        <div className="container mx-auto max-w-6xl p-8 ">
            <ToolHeader
                title="L1 Launcher"
                duration="30 min"
                description="Launch your self-hosted Testnet or Mainnet L1 on your own infrastructure"
                githubDir="l1-launcher"
                issuePath="/tools/l1-launcher"
                issueTitle="Update L1 Launcher Tool Information"
            />
            <div className="flex flex-col lg:flex-row">
                <div className="w-full lg:w-80 mb-8">
                    <Steps stepGroups={stepGroups} stepList={stepList} currentStep={stepsCurrentStep} maxAdvancedStep={stepsMaxStep} advanceTo={(step) => { setStepsCurrentStep(step) }} />
                    {/* Reset button */}
                    <div className="mt-8 -ml-4 w-full">
                        <Button
                            onClick={() => window.confirm("Are you sure you want to start over? All progress will be lost.") && reset()}
                            variant="light-danger"
                            icon={
                                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            }
                        >
                            Start Over
                        </Button>
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="h-full">
                        <ErrorBoundary FallbackComponent={ErrorFallback}>
                            <ConnectWallet required={stepsCurrentStep !== Object.keys(stepList)[0]}>
                                <Suspense fallback={<div>Loading...</div>}>
                                    {(() => {
                                        const Component = stepList[stepsCurrentStep]?.component;
                                        return Component ? <Component /> : null;
                                    })()}
                                </Suspense>
                            </ConnectWallet>
                        </ErrorBoundary>
                    </div>
                </div>
            </div>
        </div>
    </>
}

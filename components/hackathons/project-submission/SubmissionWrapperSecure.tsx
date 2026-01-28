"use client";

import React, { useState, useEffect } from "react";
import { ProjectSubmissionProvider } from "./context/ProjectSubmissionContext";
import GeneralSecureComponent from "./components/GeneralSecure";
import { UserNotRegistered } from "./components/UserNotRegistered";

export function SubmissionWrapperSecure({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [showComponent, setShowComponent] = useState(false);

  const handleShowComponent = (show: boolean) => {
    setShowComponent(show);
  };

  const hackathonId = searchParams.hackathon as string | undefined;

  // If there's no hackathonId, show the component directly (standalone project)
  useEffect(() => {
    if (!hackathonId) {
      setShowComponent(true);
    }
  }, [hackathonId]);

  return (
    <ProjectSubmissionProvider>
      {!hackathonId ? (
        // Show directly if no hackathon (standalone project)
        <GeneralSecureComponent searchParams={searchParams} />
      ) : (
        // Show UserNotRegistered check only if there's a hackathon
        <>
          {!showComponent && (
            <UserNotRegistered
              hackathonId={hackathonId}
              onToggle={handleShowComponent}
            />
          )}
          {showComponent && <GeneralSecureComponent searchParams={searchParams} />}
        </>
      )}
    </ProjectSubmissionProvider>
  );
}

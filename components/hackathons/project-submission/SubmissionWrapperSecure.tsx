"use client";

import React, { useState } from "react";
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

  return (
    <ProjectSubmissionProvider>
      {!showComponent && (
        <UserNotRegistered
          hackathonId={searchParams.hackathon as string}
          onToggle={handleShowComponent}
        />
      )}
      {showComponent && <GeneralSecureComponent searchParams={searchParams} />}
    </ProjectSubmissionProvider>
  );
}

'use client';

import React from 'react';
import { ProjectSubmissionProvider } from './context/ProjectSubmissionContext';
import GeneralSecureComponent from './components/GeneralSecure';

export function SubmissionWrapperSecure({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return (
    <ProjectSubmissionProvider>
      <GeneralSecureComponent searchParams={searchParams} />
    </ProjectSubmissionProvider>
  );
} 
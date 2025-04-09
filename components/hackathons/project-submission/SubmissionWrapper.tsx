'use client'
import React from 'react'
import General from './components/General';
import { SessionProvider } from 'next-auth/react';


export function SubmissionWrapper({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  return (
    <SessionProvider>
      <General  searchParams={searchParams} />
    </SessionProvider>
      
  );
}

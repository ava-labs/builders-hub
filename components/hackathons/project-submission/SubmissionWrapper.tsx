import React from 'react'
import General from './General';


export function SubmissionWrapper({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  return (
      <General  searchParams={searchParams} />
  );
}

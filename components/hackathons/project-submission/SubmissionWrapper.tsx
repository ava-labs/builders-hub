"use client";
import React from "react";
import General from "./components/General";


export function SubmissionWrapper({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return (
    
      <General searchParams={searchParams} />

  );
}

"use client";

import React from "react";
import { RegisterForm } from "./RegistrationForm";

export default function RegistrationFormWrapped({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return (
    <div>
      <RegisterForm searchParams={searchParams} />
    </div>
  );
}

"use client";

import { SessionProvider } from "next-auth/react";
import React from "react";
import { RegisterForm } from "./RegistrationForm";

export default function RegistrationFormWrapped({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  return (
    <div>
      <SessionProvider>
        <RegisterForm searchParams={searchParams} />
      </SessionProvider>
    </div>
  );
}

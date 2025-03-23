"use client";
import { SessionProvider } from "next-auth/react";
import Formlogin from "./FormLogin";


export default function FormLoginWrapper({ callbackUrl = '/' }: { callbackUrl?: string }) {
  return (
    <SessionProvider>
        <Formlogin callbackUrl={callbackUrl} />
    </SessionProvider>
  );
}

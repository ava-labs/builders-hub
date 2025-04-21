"use client";

import Formlogin from "./FormLogin";

export default function FormLoginWrapper({
  callbackUrl = "/",
}: {
  callbackUrl?: string;
}) {
  return <Formlogin callbackUrl={callbackUrl} />;
}

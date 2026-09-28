"use client";

import Formlogin from "./FormLogin";

export default function FormLoginWrapper({
  callbackUrl = "/",
  mode = "signin",
}: {
  callbackUrl?: string;
  mode?: "signin" | "signup";
}) {
  return <Formlogin callbackUrl={callbackUrl} mode={mode} />;
}

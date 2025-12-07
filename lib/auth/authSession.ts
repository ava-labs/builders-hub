// lib/auth-session.ts
import { getServerSession } from "next-auth";
import { AuthOptions } from "./authOptions";

export function getAuthSession() {
  return getServerSession(AuthOptions);
}

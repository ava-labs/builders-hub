// lib/auth-session.ts
import { getServerSession } from 'next-auth';
import { AuthOptions } from './authOptions';


export async function getAuthSession() {
  return await getServerSession(AuthOptions);
}

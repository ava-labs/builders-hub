'use client'
import { SessionProvider } from 'next-auth/react';
import { UserButton } from './UserButton';
export default  function UserWrapper() {
  return (
    <SessionProvider>
      <UserButton />
    </SessionProvider>
  );
}
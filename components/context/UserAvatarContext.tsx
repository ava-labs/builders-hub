'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { AvatarSeed } from '@/components/profile/components/DiceBearAvatar';

interface UserAvatarContextValue {
  nounAvatarSeed: AvatarSeed | null;
  nounAvatarEnabled: boolean;
  setNounAvatar: (seed: AvatarSeed | null, enabled: boolean) => void;
}

const UserAvatarContext = createContext<UserAvatarContextValue | null>(null);

export function UserAvatarProvider({ children }: { children: ReactNode }) {
  const [nounAvatarSeed, setNounAvatarSeed] = useState<AvatarSeed | null>(null);
  const [nounAvatarEnabled, setNounAvatarEnabled] = useState(false);

  const setNounAvatar = useCallback((seed: AvatarSeed | null, enabled: boolean) => {
    setNounAvatarSeed(seed);
    setNounAvatarEnabled(enabled);
  }, []);

  return (
    <UserAvatarContext.Provider
      value={{ nounAvatarSeed, nounAvatarEnabled, setNounAvatar }}
    >
      {children}
    </UserAvatarContext.Provider>
  );
}

export function useUserAvatar() {
  const ctx = useContext(UserAvatarContext);
  return ctx;
}

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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

  const value = useMemo(
    () => ({ nounAvatarSeed, nounAvatarEnabled, setNounAvatar }),
    [nounAvatarSeed, nounAvatarEnabled, setNounAvatar],
  );

  return (
    <UserAvatarContext.Provider value={value}>
      {children}
    </UserAvatarContext.Provider>
  );
}

export function useUserAvatar() {
  const ctx = useContext(UserAvatarContext);
  return ctx;
}

"use client";
import { useCallback, useState } from "react";
import type { PlaygroundCreator } from "../_components/types";

export interface PlaygroundMetadataState {
  // Editable values.
  playgroundName: string;
  isPublic: boolean;
  // Last-saved snapshots for dirty checking.
  savedPlaygroundName: string;
  savedIsPublic: boolean;
  // Server-owned metadata (read-only from the user's perspective).
  savedLink: string | null;
  currentPlaygroundId: string | null;
  isOwner: boolean;
  isFavorited: boolean;
  favoriteCount: number;
  viewCount: number;
  creator: PlaygroundCreator | null;
  createdAt: string | null;
  updatedAt: string | null;

  // Setters (exposed individually so the load orchestrator can hydrate them).
  setPlaygroundName: (value: string) => void;
  setIsPublic: (value: boolean) => void;
  setSavedPlaygroundName: (value: string) => void;
  setSavedIsPublic: (value: boolean) => void;
  setSavedLink: (value: string | null) => void;
  setCurrentPlaygroundId: (value: string | null) => void;
  setIsOwner: (value: boolean) => void;
  setIsFavorited: (value: boolean) => void;
  setFavoriteCount: React.Dispatch<React.SetStateAction<number>>;
  setViewCount: (value: number) => void;
  setCreator: (value: PlaygroundCreator | null) => void;
  setCreatedAt: (value: string | null) => void;
  setUpdatedAt: (value: string | null) => void;

  resetAll: () => void;
}

// Owns all the playground metadata that isn't charts and isn't time-filter:
// the name, visibility, ownership flags, social counts, and creator profile.
// Provides bulk reset for the "blank playground" navigation case.
export function usePlaygroundMetadata(
  initialPlaygroundId: string | null
): PlaygroundMetadataState {
  const [playgroundName, setPlaygroundName] = useState("");
  const [savedPlaygroundName, setSavedPlaygroundName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [savedIsPublic, setSavedIsPublic] = useState(false);
  const [savedLink, setSavedLink] = useState<string | null>(null);
  const [currentPlaygroundId, setCurrentPlaygroundId] = useState<string | null>(
    initialPlaygroundId
  );
  const [isOwner, setIsOwner] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [creator, setCreator] = useState<PlaygroundCreator | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const resetAll = useCallback(() => {
    setPlaygroundName("");
    setSavedPlaygroundName("");
    setIsPublic(false);
    setSavedIsPublic(false);
    setSavedLink(null);
    setCurrentPlaygroundId(null);
    setIsOwner(true);
    setIsFavorited(false);
    setFavoriteCount(0);
    setViewCount(0);
    setCreator(null);
    setCreatedAt(null);
    setUpdatedAt(null);
  }, []);

  return {
    playgroundName,
    isPublic,
    savedPlaygroundName,
    savedIsPublic,
    savedLink,
    currentPlaygroundId,
    isOwner,
    isFavorited,
    favoriteCount,
    viewCount,
    creator,
    createdAt,
    updatedAt,
    setPlaygroundName,
    setIsPublic,
    setSavedPlaygroundName,
    setSavedIsPublic,
    setSavedLink,
    setCurrentPlaygroundId,
    setIsOwner,
    setIsFavorited,
    setFavoriteCount,
    setViewCount,
    setCreator,
    setCreatedAt,
    setUpdatedAt,
    resetAll,
  };
}

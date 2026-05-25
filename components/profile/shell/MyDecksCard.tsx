"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, Sparkles, Library } from "lucide-react";
import {
  listUserDecks,
  type UserFlashcardDeck,
} from "@/utils/quizzes/indexedDB";

interface Props {
  onCountChange?: (count: number) => void;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function humanizeCoursePath(path: string | null): string | null {
  if (!path) return null;
  const segments = path.replace(/^\/academy\//, "").split("/");
  return segments
    .map((s) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" · ");
}

export function MyDecksCard({ onCountChange }: Props) {
  const [decks, setDecks] = React.useState<UserFlashcardDeck[] | null>(null);

  React.useEffect(() => {
    listUserDecks().then((all) => {
      all.sort((a, b) => b.updatedAt - a.updatedAt);
      setDecks(all);
      onCountChange?.(all.length);
    });
  }, [onCountChange]);

  const loading = decks === null;

  return (
    <div className="pr-card">
      <div className="pr-head">
        <div className="pr-ico">
          <Library size={18} />
        </div>
        <div>
          <h3>My Decks</h3>
          <div className="pr-desc">
            {loading
              ? "Loading your saved flashcard decks..."
              : decks!.length === 0
                ? "Save flashcard decks from the Studio to come back to them later."
                : "Your saved flashcard decks, kept on this browser."}
          </div>
        </div>
      </div>
      <div className="pr-body" style={{ gap: 12 }}>
        {loading ? (
          <>
            {Array.from({ length: 2 }).map((_unused, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: 0.4,
                }}
                aria-hidden
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    background: "var(--pr-g-300)",
                    borderRadius: 6,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      width: "45%",
                      height: 14,
                      background: "var(--pr-g-300)",
                      borderRadius: 4,
                    }}
                  />
                  <div
                    style={{
                      width: "65%",
                      height: 12,
                      background: "var(--pr-g-300)",
                      borderRadius: 4,
                      marginTop: 6,
                    }}
                  />
                </div>
              </div>
            ))}
          </>
        ) : decks!.length === 0 ? (
          <div className="pr-empty" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>No saved decks yet.</span>
            <Link
              href="/academy/flashcards"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Sparkles size={14} />
              Open the Flashcard Studio
            </Link>
          </div>
        ) : (
          <>
            {decks!.slice(0, 8).map((deck) => {
              const course = humanizeCoursePath(deck.coursePath);
              return (
                <div
                  key={deck.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "6px 0",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background:
                        "linear-gradient(135deg,#e84142,#9c2c2d)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    <BookOpen size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      href={`/academy/flashcards/play/user/${encodeURIComponent(deck.id)}`}
                      style={{
                        fontWeight: 600,
                        textDecoration: "none",
                        display: "block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {deck.name}
                    </Link>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--pr-text-2)",
                        marginTop: 2,
                      }}
                    >
                      {deck.items.length} card{deck.items.length === 1 ? "" : "s"}
                      {course ? ` · ${course}` : ""}
                      {` · saved ${timeAgo(deck.updatedAt)}`}
                    </div>
                  </div>
                  <Link
                    href={`/academy/flashcards/play/user/${encodeURIComponent(deck.id)}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 13,
                    }}
                  >
                    Open
                  </Link>
                </div>
              );
            })}
            {decks!.length > 8 && (
              <Link
                href="/academy/flashcards/library"
                style={{
                  fontSize: 13,
                  marginTop: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                View all {decks!.length} decks →
              </Link>
            )}
            {decks!.length <= 8 && (
              <Link
                href="/academy/flashcards/library"
                style={{
                  fontSize: 13,
                  marginTop: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: "var(--pr-text-2)",
                }}
              >
                Manage decks (rename, delete) →
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { openDB, type IDBPDatabase } from "idb"

export type FlashcardRatingStatus = 'new' | 'easy' | 'hard' | 'unknown'

interface QuizDB {
  quizResponses: {
    key: string
    value: {
      selectedAnswers: number[]
      isAnswerChecked: boolean
      isCorrect: boolean
      attemptCount?: number
      lastAttemptAt?: number
    }
  }
  flashcardProgress: {
    key: string
    value: {
      currentIndex: number
      viewedCards: number[]
      totalCards: number
    }
  }
  flashcardRatings: {
    key: string
    value: {
      status: FlashcardRatingStatus
      lastRatedAt: number
      timesSeen: number
    }
  }
}

const dbName = "QuizDatabase"
const quizStoreName = "quizResponses"
const flashcardStoreName = "flashcardProgress"
const flashcardRatingsStoreName = "flashcardRatings"

let dbPromise: Promise<IDBPDatabase<QuizDB>> | null = null

function getDBPromise() {
  if (!dbPromise) {
    dbPromise = openDB<QuizDB>(dbName, 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(quizStoreName)
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(flashcardStoreName)) {
            db.createObjectStore(flashcardStoreName)
          }
        }
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains(flashcardRatingsStoreName)) {
            db.createObjectStore(flashcardRatingsStoreName)
          }
        }
      },
    })
  }
  return dbPromise
}

function cardKey(setId: string, cardIndex: number): string {
  return `${setId}:${cardIndex}`
}

export async function saveQuizResponse(quizId: string, response: QuizDB["quizResponses"]["value"]) {
  if (typeof window !== "undefined") {
    const db = await getDBPromise()
    await db.put(quizStoreName, response, quizId)
  }
}

export async function getQuizResponse(quizId: string): Promise<QuizDB["quizResponses"]["value"] | undefined> {
  if (typeof window !== "undefined") {
    const db = await getDBPromise()
    return db.get(quizStoreName, quizId)
  }
  return undefined
}

export async function resetQuizResponse(quizId: string) {
  if (typeof window !== "undefined") {
    const db = await getDBPromise()
    await db.delete(quizStoreName, quizId)
  }
}

// Flashcard functions
export async function saveFlashcardProgress(flashcardSetId: string, progress: QuizDB["flashcardProgress"]["value"]) {
  if (typeof window !== "undefined") {
    const db = await getDBPromise()
    await db.put(flashcardStoreName, progress, flashcardSetId)
  }
}

export async function getFlashcardProgress(
  flashcardSetId: string,
): Promise<QuizDB["flashcardProgress"]["value"] | undefined> {
  if (typeof window !== "undefined") {
    const db = await getDBPromise()
    return db.get(flashcardStoreName, flashcardSetId)
  }
  return undefined
}

export async function resetFlashcardProgress(flashcardSetId: string) {
  if (typeof window !== "undefined") {
    const db = await getDBPromise()
    await db.delete(flashcardStoreName, flashcardSetId)
  }
}

// Flashcard per-card ratings (Easy / Hard / Don't Know) for the play page.
// Stored separately from the legacy `flashcardProgress` store so the existing
// in-MDX <Flashcard /> component keeps using its own state untouched.

export type FlashcardRating = QuizDB["flashcardRatings"]["value"]

export async function getCardRating(
  flashcardSetId: string,
  cardIndex: number,
): Promise<FlashcardRating | undefined> {
  if (typeof window === "undefined") return undefined
  const db = await getDBPromise()
  return db.get(flashcardRatingsStoreName, cardKey(flashcardSetId, cardIndex))
}

export async function setCardRating(
  flashcardSetId: string,
  cardIndex: number,
  status: FlashcardRatingStatus,
): Promise<FlashcardRating> {
  const existing = await getCardRating(flashcardSetId, cardIndex)
  const next: FlashcardRating = {
    status,
    lastRatedAt: Date.now(),
    timesSeen: (existing?.timesSeen ?? 0) + 1,
  }
  if (typeof window !== "undefined") {
    const db = await getDBPromise()
    await db.put(flashcardRatingsStoreName, next, cardKey(flashcardSetId, cardIndex))
  }
  return next
}

/**
 * Load every per-card rating for a deck. Returns an object keyed by card index
 * (string) for direct lookup in the play UI's state map.
 */
export async function getDeckRatings(
  flashcardSetId: string,
  totalCards: number,
): Promise<Record<number, FlashcardRating>> {
  const out: Record<number, FlashcardRating> = {}
  if (typeof window === "undefined") return out
  const db = await getDBPromise()
  await Promise.all(
    Array.from({ length: totalCards }, async (_unused, i) => {
      const value = await db.get(flashcardRatingsStoreName, cardKey(flashcardSetId, i))
      if (value) out[i] = value
    }),
  )
  return out
}

export async function resetDeckRatings(flashcardSetId: string, totalCards: number): Promise<void> {
  if (typeof window === "undefined") return
  const db = await getDBPromise()
  await Promise.all(
    Array.from({ length: totalCards }, (_unused, i) =>
      db.delete(flashcardRatingsStoreName, cardKey(flashcardSetId, i)),
    ),
  )
}

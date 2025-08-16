import { openDB, type IDBPDatabase } from "idb"

interface QuizDB {
  quizResponses: {
    key: string
    value: {
      selectedAnswers: number[]
      isAnswerChecked: boolean
      isCorrect: boolean
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
}

const dbName = "QuizDatabase"
const quizStoreName = "quizResponses"
const flashcardStoreName = "flashcardProgress"

let dbPromise: Promise<IDBPDatabase<QuizDB>> | null = null

function getDBPromise() {
  if (!dbPromise) {
    dbPromise = openDB<QuizDB>(dbName, 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(quizStoreName)
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(flashcardStoreName)) {
            db.createObjectStore(flashcardStoreName)
          }
        }
      },
    })
  }
  return dbPromise
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

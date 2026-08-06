import { openDB, type IDBPDatabase } from "idb"

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

type QuizResponseValue = QuizDB["quizResponses"]["value"]

// ---------------------------------------------------------------------------
// Server sync (issue #4357)
//
// IndexedDB stays the local cache and the synchronous source of truth for the
// UI, but every response is mirrored to the account via /api/quiz-progress so
// progress survives browser switches and IndexedDB eviction. Signed-out users
// keep the old local-only behavior: the API answers 401 and we stay quiet.
// ---------------------------------------------------------------------------

let syncPromise: Promise<void> | null = null
// null = unknown, false = signed out (skip pushes instead of spamming 401s)
let serverHasAccount: boolean | null = null

function betterOf(a: QuizResponseValue, b: QuizResponseValue): QuizResponseValue {
  if (a.isCorrect !== b.isCorrect) return a.isCorrect ? a : b
  if ((a.attemptCount ?? 0) !== (b.attemptCount ?? 0))
    return (a.attemptCount ?? 0) > (b.attemptCount ?? 0) ? a : b
  return (a.lastAttemptAt ?? 0) >= (b.lastAttemptAt ?? 0) ? a : b
}

async function getAllLocalResponses(): Promise<Map<string, QuizResponseValue>> {
  const db = await getDBPromise()
  const keys = (await db.getAllKeys(quizStoreName)) as string[]
  const values = await db.getAll(quizStoreName)
  return new Map(keys.map((k, i) => [k, values[i]]))
}

/**
 * One-shot per page load: pull the account's responses, merge them into
 * IndexedDB (correct wins, then attempts, then recency), then push every
 * local row the server doesn't have or has a worse version of. That push IS
 * the backfill — pre-existing browser progress lands in the DB on the first
 * signed-in visit without any server-side job.
 */
function ensureSynced(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (!syncPromise) {
    syncPromise = (async () => {
      let serverRows: Array<QuizResponseValue & { quizId: string }>
      try {
        const res = await fetch("/api/quiz-progress", {
          signal: AbortSignal.timeout(4000),
        })
        if (res.status === 401 || res.status === 403) {
          serverHasAccount = false // signed out — stay local, skip later pushes
          return
        }
        if (!res.ok) return // transient — stay local, retried next page load
        serverHasAccount = true
        serverRows = (await res.json()).responses ?? []
      } catch {
        return // offline/timeout — stay local, retried on next page load
      }

      try {
        const local = await getAllLocalResponses()
        const server = new Map(serverRows.map((r) => [r.quizId, r]))

        // Server → local: adopt server rows that beat what we have
        const db = await getDBPromise()
        for (const [quizId, remote] of server) {
          const mine = local.get(quizId)
          if (!mine || betterOf(remote, mine) === remote) {
            const { quizId: _, ...value } = remote
            await db.put(quizStoreName, value, quizId)
          }
        }

        // Local → server: backfill rows the server lacks or trails on
        const toPush = [...local.entries()]
          .filter(([quizId, mine]) => {
            const remote = server.get(quizId)
            return !remote || betterOf(mine, remote) === mine
          })
          .map(([quizId, value]) => ({ quizId, ...value }))

        if (toPush.length > 0) {
          await fetch("/api/quiz-progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toPush),
          })
        }
      } catch (error) {
        console.error("[quiz-sync] initial sync failed:", error)
      }
    })()
  }
  return syncPromise
}

async function pushResponse(quizId: string, response: QuizResponseValue): Promise<void> {
  if (serverHasAccount === false) return // signed out — local-only, no 401 noise
  // Awaited (not fire-and-forget) so that when quiz.tsx awaits
  // saveQuizResponse before firing onQuizCompleted, the server already has
  // the row — the badge award's course-completion check depends on it. A
  // failed push never blocks local save; it self-heals on the next page
  // load, when ensureSynced pushes local rows the server is missing.
  try {
    await fetch(`/api/quiz-progress/${encodeURIComponent(quizId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
      signal: AbortSignal.timeout(4000),
    })
  } catch (error) {
    console.error("[quiz-sync] PUT failed for", quizId, error)
  }
}

export async function saveQuizResponse(quizId: string, response: QuizResponseValue) {
  if (typeof window !== "undefined") {
    const db = await getDBPromise()
    await db.put(quizStoreName, response, quizId)
    await pushResponse(quizId, response)
  }
}

export async function getQuizResponse(quizId: string): Promise<QuizResponseValue | undefined> {
  if (typeof window !== "undefined") {
    await ensureSynced()
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

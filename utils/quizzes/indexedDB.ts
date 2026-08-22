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
  syncMeta: {
    key: string
    value: string
  }
}

const dbName = "QuizDatabase"
const quizStoreName = "quizResponses"
const flashcardStoreName = "flashcardProgress"
const syncMetaStoreName = "syncMeta"
// syncMeta key holding the user id of the account the local rows belong to
// (or were adopted by). Rows written while signed out have no owner until the
// first signed-in sync claims them.
const lastSyncedUserKey = "lastSyncedUserId"

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
          if (!db.objectStoreNames.contains(syncMetaStoreName)) {
            db.createObjectStore(syncMetaStoreName)
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
      let serverUserId: string | undefined
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
        const payload = await res.json()
        serverRows = payload.responses ?? []
        serverUserId = payload.userId
      } catch {
        return // offline/timeout — stay local, retried on next page load
      }

      try {
        const db = await getDBPromise()

        // Account boundary: local rows belong to the account recorded at the
        // last signed-in sync (anonymous rows are claimed by it below). If a
        // different account is signed in now, those rows must not leak into
        // it — neither through the backfill POST nor through reads that feed
        // course-completion awards. Their owner's copy is already on the
        // server, so dropping them here loses nothing.
        const lastUser = await db.get(syncMetaStoreName, lastSyncedUserKey)
        if (serverUserId && lastUser && lastUser !== serverUserId) {
          await db.clear(quizStoreName)
        }

        const local = await getAllLocalResponses()
        const server = new Map(serverRows.map((r) => [r.quizId, r]))

        // Server → local: adopt server rows that beat what we have
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

        // Record who the local rows belong to from here on. This also claims
        // anonymous pre-login rows for the account that just adopted them.
        if (serverUserId) {
          await db.put(syncMetaStoreName, serverUserId, lastSyncedUserKey)
        }
      } catch (error) {
        console.error("[quiz-sync] initial sync failed:", error)
      }
    })()
  }
  return syncPromise
}

let resyncInFlight: Promise<void> | null = null

/**
 * Re-run the account sync after the auth session changes without a page load
 * (the login modal closes in place — no navigation, so the module state above
 * survives). Discards the cached one-shot sync AND the cached signed-out
 * verdict, so the pull sees the account's rows and later saves push again.
 * Concurrent callers (every mounted quiz fires on the same login event)
 * share one pass.
 */
export function resyncQuizProgress(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (!resyncInFlight) {
    syncPromise = null
    serverHasAccount = null
    resyncInFlight = ensureSynced().finally(() => {
      resyncInFlight = null
    })
  }
  return resyncInFlight
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

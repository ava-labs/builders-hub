import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Every quiz listed in a certificate-bearing course's JSON must be embedded
// (<Quiz quizId="..."/>) somewhere in that course's content directory —
// otherwise the certificate can never be obtained (learners get stuck at N-1/N).

const ACADEMY_DIR = path.join(__dirname, '../../../content/academy')
const DATA_DIR = path.join(__dirname, '../../../components/quizzes/data/courses')

function mdxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return mdxFiles(full)
    return /\.mdx?$/.test(entry.name) ? [full] : []
  })
}

// Discover certificate pages: any academy MDX containing courseId="<slug>".
// The course's content dir is the directory containing the certificate page.
const certificateCourses: { courseId: string; courseDir: string }[] = []
for (const file of mdxFiles(ACADEMY_DIR)) {
  const content = fs.readFileSync(file, 'utf8')
  for (const match of content.matchAll(/courseId="([^"]+)"/g)) {
    certificateCourses.push({ courseId: match[1], courseDir: path.dirname(file) })
  }
}

function embeddedQuizIds(dir: string): Set<string> {
  const ids = new Set<string>()
  for (const file of mdxFiles(dir)) {
    const content = fs.readFileSync(file, 'utf8')
    for (const match of content.matchAll(/<Quiz\s+quizId=["'{]+\s*["']?(\w+)/g)) {
      ids.add(match[1])
    }
  }
  return ids
}

// Quiz data files left over from removed/renamed courses: no content dir, no
// certificate page, none of their quizzes embedded anywhere. Excluded from the
// global check below; remove an entry here if its course comes back (or delete the file).
const LEGACY_COURSE_FILES = [
  'avacloudapis',
  'icm-chainlink',
  'interchain-token-transfer',
  'multichain-architecture',
]

describe('course quiz integrity', () => {
  it('found certificate pages to check', () => {
    expect(certificateCourses.length).toBeGreaterThan(0)
  })

  for (const { courseId, courseDir } of certificateCourses) {
    it(`${courseId}: every quiz in the course JSON is embedded in the course content`, () => {
      const dataFile = path.join(DATA_DIR, `${courseId}.json`)
      expect(fs.existsSync(dataFile), `missing quiz data file for courseId "${courseId}"`).toBe(true)
      const quizIds = Object.keys(JSON.parse(fs.readFileSync(dataFile, 'utf8')).quizzes)
      const embedded = embeddedQuizIds(courseDir)
      const missing = quizIds.filter((id) => !embedded.has(id))
      expect(
        missing,
        `quizzes counted by the ${courseId} certificate but not embedded in ${path.relative(process.cwd(), courseDir)} — certificate is unobtainable`
      ).toEqual([])
    })
  }

  // Softer global check: every quiz defined in any course JSON must be embedded
  // somewhere in the academy content — catches dead quiz data in courses without
  // a certificate page (e.g. team1) that the per-certificate checks above miss.
  const allEmbedded = embeddedQuizIds(ACADEMY_DIR)
  for (const file of fs.readdirSync(DATA_DIR)) {
    const courseId = file.replace(/\.json$/, '')
    if (LEGACY_COURSE_FILES.includes(courseId)) continue
    it(`${courseId}: every quiz in the course JSON is embedded somewhere in content/academy`, () => {
      const quizIds = Object.keys(JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')).quizzes)
      const missing = quizIds.filter((id) => !allEmbedded.has(id))
      expect(missing, `quizzes defined in ${file} but rendered on no page`).toEqual([])
    })
  }
})

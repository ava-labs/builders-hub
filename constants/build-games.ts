/**
 * Build Games runs as a Hackathon row with a fixed id, and several features
 * special-case it (its own landing page, applications in their own table,
 * invite links, showcase badges).
 *
 * NOTE: this id is still inlined as a local literal in ~13 other modules
 * (`grep -rl 249d2911 app components lib`); import this constant in new code
 * and migrate the rest opportunistically.
 */
export const BUILD_GAMES_HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

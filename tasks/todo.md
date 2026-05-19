- [x] Inspect current and previous achievements badge rendering
- [x] Restore category and rank grouping in the redesigned profile
- [x] Keep locked/unearned badges visible in the new design
- [x] Verify typecheck and document review notes

## Review

- Reused the legacy reward-board grouping rules: Console, Blockchain
  Academy, Avalanche L1 Academy, and Entrepreneur Academy.
- Preserved Console rank grouping by tier with Bronze, Silver, Gold, and
  Secret subsections.
- Changed the redesigned summary API to return all displayable badges with
  unlock state overlaid, so locked badges remain visible.
- Verified with `npx tsc --noEmit --project tsconfig.json`.
- Browser verification was attempted against `localhost:3001` and
  `127.0.0.1:3001`, but the in-app browser blocked both URLs with
  `ERR_BLOCKED_BY_CLIENT`.

## Cleanup Pass

- [x] Rename the remaining profile `redesign` shell path/imports
- [x] Identify old profile-adjacent notification, insights, project, and
  achievement UI now covered by profile tabs
- [x] Remove or disconnect obsolete code with minimal blast radius
- [x] Verify typecheck and document cleanup results

### Cleanup Review

- Renamed `components/profile/redesign` to `components/profile/shell` and
  updated the shell import from `profile-tab`.
- Removed the top-nav `NotificationBell` render and deleted the now-unused
  bell component, notification markdown wrapper, and notification fetch hook.
- Converted `/builder-insights`, `/send-notifications`, and
  `/profile/rewards-board` to redirects into the matching profile tabs.
- Deleted the standalone `BuilderInsightsDashboard` and old
  `reward-board.tsx` route component after those routes stopped rendering
  them.
- Kept `SendNotificationsForm`, notification API routes, and
  `RewardBoardTab` because the profile Notifications tab still uses the form,
  API routes may be integration entry points, and the reward board tab remains
  referenced by the legacy profile fallback.
- Verified with `npx tsc --noEmit --project tsconfig.json`,
  `git diff --check`, and browser checks on `localhost:3000`.

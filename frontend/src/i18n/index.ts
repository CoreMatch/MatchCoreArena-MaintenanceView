// Centralized UI string resources (i18n).
//
// Product direction: English is the primary UI language; other locales are
// reserved as an extension point. All user-facing copy added from the
// match-operations pages onward lives in this dictionary — no hardcoded
// strings scattered in components. The translation layer is intentionally
// minimal (lookup + fallback); a full multi-locale rollout only needs new
// entries in `messages` plus a locale switch.

export type Locale = 'en';

const messages = {
  en: {
    // ── Match Reporter ──
    'reporter.title': 'Match Reporter',
    'reporter.intro':
      'Developer debug console: feeds matches through the regular POST /api/matches endpoint (there is no separate "virtual match" channel). OPS-grade service tokens are held by this backend and proxied server-side; the UI never touches plaintext credentials. Participant UUIDs must resolve in HRPAuth or the report is rejected.',
    'reporter.single.title': 'Report a single match',
    'reporter.batch.title': 'Batch feed',
    'reporter.batch.intro':
      'Paste a TeamReportInput JSON object or array (same fields as the single form: match_type, winner_team, loser_teams, duration_seconds, started_at, finished_at). Items are submitted sequentially to the same endpoint.',
    'reporter.batch.placeholder':
      '[{"match_type":"1v1","winner_team":{"team_id":"A","members":[{"uuid":"<winner UUID>"}]},"loser_teams":[{"team_id":"B","members":[{"uuid":"<loser UUID>"}]}]}]',
    'reporter.batch.submit': 'Batch report',
    'reporter.batch.running': 'Feeding...',
    'reporter.batch.parseFailed': 'JSON parse failed',
    'reporter.batch.badShape': 'Batch content must be a TeamReportInput JSON object or an array of them',
    'reporter.batch.empty': 'Batch content is empty',
    'reporter.winnerTeam': 'Winner team',
    'reporter.loserTeams': 'Loser teams',
    'reporter.addLoserTeam': 'Add loser team',
    'reporter.addMember': 'Add member',
    'reporter.submit': 'Report match',
    'reporter.submitting': 'Reporting...',
    'reporter.recorded': 'recorded',
    'reporter.source': 'source',
    'reporter.sourceLabel': 'Source',
    'reporter.sourceGame': 'game (real match)',
    'reporter.sourceVirtual': 'virtual (ops-fed test match)',
    'reporter.sourceNote':
      'Virtual matches go through the same POST /api/matches endpoint and settlement path as real matches; only the source tag differs.',
    'reporter.matchmakingGroupId': 'Matchmaking group ID',
    'reporter.matchmakingGroupIdNote':
      'Optional. Set to a formed group\u2019s ID (from the Matchmaking page) so same-party members share averaged rating deltas. 0 = no party settlement.',
    'reporter.winnerTeamLabel': 'winner team',
    'reporter.noParticipants': 'The server returned no participant details (check the match detail later for rating changes).',
    'reporter.eloNote':
      'Rating parameters (Elo weights etc.) are controlled by the server; this panel only displays before / delta / after.',
    'reporter.success': 'Match reported',
    'reporter.view': 'View',

    // ── field validation (B1) ──
    'validation.summary': 'Fix these before reporting:',
    'validation.matchType': 'Match type must look like 1v1v1 or 2v2v2.',
    'validation.timeFormat': 'Timestamps must be RFC3339 (e.g. 2026-11-06T12:00:00Z).',
    'validation.timeOrder': 'finished_at must be after started_at.',
    'validation.durationMismatch': "Duration doesn't match the start/end timestamps.",
    'validation.missingUuid': 'Every member needs a UUID.',
    'validation.invalidUuid': 'Invalid player UUID.',
    'validation.perfRange': 'perf_tweak must be within [0.95, 1.05].',
    'validation.initialCount': 'initial_count must be at least 1.',
    'validation.aliveRange': 'alive_count must be between 0 and initial_count.',
    'validation.winnerAlive': 'The winner team must have at least one survivor.',
    'validation.memberCount': 'More members listed than initial_count.',
    'validation.teamIdRequired': 'team_id must not be empty.',
    'validation.duplicateTeamId': 'Team IDs must be unique.',
    'validation.needsLoser': 'At least one loser team is required.',
    'validation.teamPrefix': 'Team',

    // ── batch progress (B1) ──
    'reporter.batch.reporting': 'Reporting',
    'reporter.batch.reported': 'reported',
    'reporter.batch.failed': 'failed',

    // ── shared table headers / labels ──
    'table.uid': 'UID',
    'table.team': 'Team',
    'table.result': 'Result',
    'table.before': 'Before',
    'table.delta': 'Delta',
    'table.after': 'After',
    'table.index': '#',
    'table.status': 'Status',
    'table.matchOrError': 'Match ID / Error',
    'table.rank': 'Rank',
    'table.player': 'Player',
    'table.type': 'Type',
    'table.score': 'Score',
    'table.season': 'Season',
    'table.updatedAt': 'Updated at',
    'table.match': 'Match',
    'table.sourceCol': 'Source',
    'table.time': 'Time',
    'result.win': 'win',
    'result.lose': 'lose',
    'result.draw': 'draw',
    'status.success': 'OK',
    'status.failed': 'Failed',

    // ── Matchmaking ──
    'matchmaking.title': 'Matchmaking',
    'matchmaking.intro':
      'Acts as the identity resolved from the backend-configured service token (the management token maps to UID -1). Intended for debugging the matchmaking engine.',
    'matchmaking.mode': 'Mode (match_type)',
    'matchmaking.join': 'Join queue',
    'matchmaking.leave': 'Leave queue',
    'matchmaking.refresh': 'Refresh status',
    'matchmaking.joined': 'Joined the queue',
    'matchmaking.left': 'Left the queue',
    'matchmaking.inQueue': 'In queue',
    'matchmaking.notInQueue': 'Not in queue',
    'matchmaking.modeLabel': 'mode',
    'matchmaking.rating': 'rating',
    'matchmaking.enqueuedAt': 'enqueued at',
    'matchmaking.recentGroups': 'Recent formed groups (involving this identity)',
    'matchmaking.noGroups': 'None yet',
    'matchmaking.group': 'group',
    'matchmaking.formedAt': 'formed at',
    'matchmaking.waiting': 'Waiting',
    'matchmaking.autoRefresh': 'Auto-refreshing every 5s',
    'matchmaking.party.title': 'Party (optional)',
    'matchmaking.party.note':
      'Queue as a party: the listed UUIDs are sent as party_members and matched as one unit (never split across teams). To settle with shared rating deltas, report the match with the formed group\u2019s matchmaking_group_id.',
    'matchmaking.party.placeholder': 'Player UUID',
    'matchmaking.party.add': 'Add player UUID',
    'matchmaking.party.size': 'Party size',
    'matchmaking.party.queueAs': 'Queue as party',
    'matchmaking.party.invalidUuid': 'Invalid player UUID.',

    // ── OPS identity (B3) ──
    'ops.reporter': 'OPS token: reporter configured',
    'ops.fallback': 'OPS token: using management token',
    'ops.none': 'OPS token: not configured',
    'ops.upstream': 'upstream',

    // ── request log (B4) ──
    'reqlog.title': 'Request log',
    'reqlog.empty': 'No requests yet.',
    'reqlog.refresh': 'Refresh',
    'reqlog.time': 'Time',
    'reqlog.method': 'Method',
    'reqlog.path': 'Path',
    'reqlog.status': 'Status',
    'reqlog.code': 'Code',

    // ── Rankings & History ──
    'rankings.title': 'Rankings & History',
    'rankings.intro':
      'Read-only views: rankings and player history come from live data. Season pages are not provided yet (queries use the current season).',
    'rankings.top.title': 'Top N Rankings',
    'rankings.top.load': 'Load rankings',
    'rankings.top.loading': 'Loading...',
    'rankings.top.empty': 'No data yet (no ranking entries for this type/season).',
    'rankings.limit': 'limit',
    'rankings.history.title': 'Player match history',
    'rankings.history.uid': 'Player UID',
    'rankings.history.count': 'Rows',
    'rankings.history.load': 'Load history',
    'rankings.history.loading': 'Loading...',
    'rankings.history.invalidUid': 'Enter a valid player UID (positive integer)',
    'rankings.history.empty': 'has no match records.',
    'rankings.history.player': 'Player',

    // ── Config Manager (MCA proxy section) ──
    'config.mcaSection': 'MCA Proxy (OPS)',
    'config.reporterToken': 'Reporter Token (match:report service token; empty = reuse Management Token)',
  },
} as const;

export type MessageKey = keyof (typeof messages)['en'];

let currentLocale: Locale = 'en';

// setLocale switches the active locale. Only 'en' is populated today;
// unknown locales fall back to English per key.
export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

// t resolves a message key against the active locale with English fallback.
export function t(key: MessageKey): string {
  const table = messages[currentLocale] ?? messages.en;
  return (table as Record<string, string>)[key] ?? messages.en[key] ?? key;
}

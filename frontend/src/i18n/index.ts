// Central UI message catalog (i18n).
//
// Product direction: English is the primary UI language; other locales are
// reserved for the future. Adding a language means adding one catalog object
// with the same shape as `en` to `catalogs` and extending the `Locale` type.
// Components must read user-visible strings through `t()` instead of
// hard-coding them.
//
// English is the source; adding a locale means adding one catalog object.

export type Locale = 'en';

const en = {
  // ── App shell / navigation ──
  app: {
    title: 'MCA Maintenance Panel',
  },
  nav: {
    dashboard: 'Dashboard',
    redis: 'Redis Browser',
    database: 'Database',
    match: 'Match Manager',
    reporter: 'Match Reporter',
    browser: 'Match Browser',
    matchmaking: 'Matchmaking',
    rankings: 'Rankings & History',
    rating: 'Rating Simulator',
    config: 'Config Manager',
  },

  // ── Dashboard ──
  dashboard: {
    title: 'System Overview',
    totalUsers: 'Total Users',
    inQueue: 'In Queue',
    matchesReported: 'Matches Reported',
    metricsUnavailable:
      'Live metrics are unavailable (OPS token not configured or the upstream is unreachable); queue and match counters are shown as unknown.',
    upstreamServer: 'Upstream Server',
    loading: 'Loading...',
  },

  // ── Match Manager ──
  match: {
    title: 'Match Management',
    manualUpload: 'Manual Match Result Upload',
    uid: 'User UID',
    matchId: 'Match ID',
    rank: 'Rank',
    scoreDelta: 'Score Delta',
    survivorCount: 'Survivor Count',
    isWinner: 'Is Winner',
    uploadResult: 'Upload Result',
    uploadSuccess: 'Match result uploaded successfully!',
    uploadFailed: 'Failed to upload match result',
  },

  // ── Match Reporter ──
  reporter: {
    title: 'Match Reporter',
    intro:
      'Developer debug console: feeds matches through the regular POST /api/matches endpoint (there is no separate "virtual match" channel). OPS-grade service tokens are held by this backend and proxied server-side; the UI never touches plaintext credentials. Participant UUIDs must resolve in HRPAuth or the report is rejected.',
    singleTitle: 'Report a single match',
    batchTitle: 'Batch feed',
    batchIntro:
      'Paste a TeamReportInput JSON object or array (same fields as the single form: match_type, winner_team, loser_teams, duration_seconds, started_at, finished_at). Items are submitted sequentially to the same endpoint.',
    batchPlaceholder:
      '[{"match_type":"1v1","winner_team":{"team_id":"A","members":[{"uuid":"<winner UUID>"}]},"loser_teams":[{"team_id":"B","members":[{"uuid":"<loser UUID>"}]}]}]',
    batchSubmit: 'Batch report',
    batchRunning: 'Feeding...',
    batchParseFailed: 'JSON parse failed',
    batchBadShape: 'Batch content must be a TeamReportInput JSON object or an array of them',
    batchEmpty: 'Batch content is empty',
    batchReporting: 'Reporting',
    batchReported: 'reported',
    batchFailed: 'failed',
    winnerTeam: 'Winner team',
    loserTeams: 'Loser teams',
    addLoserTeam: 'Add loser team',
    addMember: 'Add member',
    submit: 'Report match',
    submitting: 'Reporting...',
    recorded: 'recorded',
    source: 'source',
    sourceLabel: 'Source',
    sourceGame: 'game (real match)',
    sourceVirtual: 'virtual (ops-fed test match)',
    sourceNote:
      'Virtual matches go through the same POST /api/matches endpoint and settlement path as real matches; only the source tag differs.',
    matchmakingGroupId: 'Matchmaking group ID',
    matchmakingGroupIdNote:
      'Optional. Set to a formed group\u2019s ID (from the Matchmaking page) so same-party members share averaged rating deltas. 0 = no party settlement.',
    winnerTeamLabel: 'winner team',
    noParticipants: 'The server returned no participant details (check the match detail later for rating changes).',
    eloNote:
      'Rating parameters (Elo weights etc.) are controlled by the server; this panel only displays before / delta / after.',
    success: 'Match reported',
    view: 'View',
  },

  // ── Validation (shared by reporter) ──
  validation: {
    summary: 'Fix these before reporting:',
    matchType: 'Match type must look like 1v1v1 or 2v2v2.',
    timeFormat: 'Timestamps must be RFC3339 (e.g. 2026-11-06T12:00:00Z).',
    timeOrder: 'finished_at must be after started_at.',
    durationMismatch: "Duration doesn't match the start/end timestamps.",
    missingUuid: 'Every member needs a UUID.',
    invalidUuid: 'Invalid player UUID.',
    perfRange: 'perf_tweak must be within [0.95, 1.05].',
    initialCount: 'initial_count must be at least 1.',
    aliveRange: 'alive_count must be between 0 and initial_count.',
    winnerAlive: 'The winner team must have at least one survivor.',
    memberCount: 'More members listed than initial_count.',
    teamIdRequired: 'team_id must not be empty.',
    duplicateTeamId: 'Team IDs must be unique.',
    needsLoser: 'At least one loser team is required.',
    teamPrefix: 'Team',
  },

  // ── Shared table headers / labels ──
  table: {
    uid: 'UID',
    team: 'Team',
    result: 'Result',
    before: 'Before',
    delta: 'Delta',
    after: 'After',
    index: '#',
    status: 'Status',
    matchOrError: 'Match ID / Error',
    rank: 'Rank',
    player: 'Player',
    type: 'Type',
    score: 'Score',
    season: 'Season',
    updatedAt: 'Updated at',
    match: 'Match',
    sourceCol: 'Source',
    time: 'Time',
    gameId: 'game_id',
    serverId: 'server_id',
    finishedAt: 'Finished',
    reason: 'Reason',
    winner: 'Winner',
    id: 'ID',
    key: 'Key',
    ttl: 'TTL (s)',
    actions: 'Actions',
    level: 'Level',
    exp: 'Exp',
    rankScore: 'Rank Score',
    wins: 'Wins',
  },

  result: {
    win: 'win',
    lose: 'lose',
    draw: 'draw',
  },

  status: {
    success: 'OK',
    failed: 'Failed',
  },

  // ── Matchmaking ──
  matchmaking: {
    title: 'Matchmaking',
    intro:
      'Acts as the identity resolved from the backend-configured service token (the management token maps to UID -1). Intended for debugging the matchmaking engine.',
    mode: 'Mode (match_type)',
    join: 'Join queue',
    leave: 'Leave queue',
    refresh: 'Refresh status',
    joined: 'Joined the queue',
    left: 'Left the queue',
    inQueue: 'In queue',
    notInQueue: 'Not in queue',
    modeLabel: 'mode',
    rating: 'rating',
    enqueuedAt: 'enqueued at',
    recentGroups: 'Recent formed groups (involving this identity)',
    noGroups: 'None yet',
    group: 'group',
    formedAt: 'formed at',
    waiting: 'Waiting',
    players: 'players',
    parties: 'parties',
    avgWait: 'Avg wait',
    queueStatsUnavailable: 'Queue stats unavailable (older server build)',
    joinTarget: 'Join target',
    autoRefresh: 'Auto-refreshing every 5s',
    partyTitle: 'Party (optional)',
    partyNote:
      'Queue as a party: the listed UUIDs are sent as party_members and matched as one unit (never split across teams). To settle with shared rating deltas, report the match with the formed group\u2019s matchmaking_group_id.',
    partyPlaceholder: 'Player UUID',
    partyAdd: 'Add player UUID',
    partySize: 'Party size',
    partyQueueAs: 'Queue as party',
    partyInvalidUuid: 'Invalid player UUID.',
  },

  // ── OPS identity ──
  ops: {
    reporter: 'OPS token: reporter configured',
    fallback: 'OPS token: using management token',
    none: 'OPS token: not configured',
    upstream: 'upstream',
  },

  // ── Request log ──
  reqlog: {
    title: 'Request log',
    empty: 'No requests yet.',
    refresh: 'Refresh',
    time: 'Time',
    method: 'Method',
    path: 'Path',
    status: 'Status',
    code: 'Code',
  },

  // ── Match Browser ──
  browser: {
    title: 'Match Browser',
    intro:
      'OPS-only read-only queries (contract v1.5.0): global match list with filters, direct lookup by the game_id idempotency key, and the server-side rejection ring.',
    listTitle: 'All matches',
    listIntro: 'Sorted by finish time (newest first); entries carry the same shape as the match detail.',
    filterSource: 'source (any/game/virtual)',
    filterMap: 'map_name',
    filterGameId: 'game_id',
    filterUid: 'participant uid',
    filterFrom: 'finished_from (RFC3339)',
    filterTo: 'finished_to (RFC3339)',
    pageSize: 'page size',
    load: 'Query',
    loading: 'Loading...',
    empty: 'No matches found for these filters.',
    page: 'Page',
    lookupTitle: 'Look up by game_id',
    lookupIntro:
      'Direct lookup by the reporter-supplied idempotency key — handy for replay/conflict investigations.',
    lookupButton: 'Look up',
    lookupEmpty: 'Enter a game_id to look up.',
    rejectionsTitle: 'Report rejections',
    rejectionsNote:
      'In-process ring on the server: last 200 entries only, cleared on server restart.',
    rejectionsRefresh: 'Refresh',
    rejectionsEmpty: 'No rejections recorded.',
    detailTitle: 'Settlement detail',
    detailHint: 'Select a match above (or look one up) to see its settlement.',
    detailMatch: 'Match',
  },

  // ── Server metrics ──
  metrics: {
    title: 'Server Metrics',
    intro:
      'OPS-only read-only snapshot (GET /api/metrics): in-process counters and per-mode queue depth.',
    refresh: 'Refresh metrics',
    loading: 'Loading...',
    counters: 'Counters',
    countersEmpty: 'No counters recorded yet.',
    queueDepth: 'Queue depth (by mode)',
    queueDepthEmpty: 'No queued players.',
    counter: 'Counter',
    value: 'Value',
    mode: 'Mode',
    depth: 'Depth',
  },

  // ── Rankings & History ──
  rankings: {
    title: 'Rankings & History',
    intro:
      'Read-only views: rankings and player history come from live data. Season pages are not provided yet (queries use the current season).',
    topTitle: 'Top N Rankings',
    topLoad: 'Load rankings',
    topLoading: 'Loading...',
    topEmpty: 'No data yet (no ranking entries for this type/season).',
    limit: 'limit',
    historyTitle: 'Player match history',
    historyUid: 'Player UID',
    historyCount: 'Rows',
    historyLoad: 'Load history',
    historyLoading: 'Loading...',
    historyInvalidUid: 'Enter a valid player UID (positive integer)',
    historyEmpty: 'has no match records.',
    historyPlayer: 'Player',
    rankType: 'rank_type',
  },

  // ── Config Manager ──
  config: {
    title: 'Configuration Management',
    editCurrent: 'Edit Current Configuration',
    upstreamUrl: 'Upstream URL',
    managementToken: 'Management Token',
    mcaSection: 'MCA Proxy (OPS)',
    reporterToken: 'Reporter Token (match:report service token; empty = reuse Management Token)',
    databaseSection: 'Database',
    dsn: 'DSN',
    redisSection: 'Redis',
    address: 'Address',
    db: 'DB',
    saveBackup: 'Save & Backup',
    versionHistory: 'Version History',
    time: 'Time',
    action: 'Action',
    restoreVersion: 'Restore this version',
    noHistory: 'No history yet',
    saveSuccess: 'Configuration saved and backed up successfully!',
    saveFailed: 'Failed to save configuration',
    restoreSuccess: 'Configuration restored successfully!',
    restoreFailed: 'Failed to restore configuration',
  },

  // ── Rating Simulator ──
  rating: {
    title: 'Rating Algorithm Simulator',
    inputParams: 'Input Parameters',
    playerRating: 'Player Rating',
    opponentRating: 'Opponent Rating',
    winsCount: 'Wins Count',
    streak: 'Streak',
    survivors: 'Survivors',
    teamSize: 'Team Size',
    performance: 'Performance (0.95-1.05)',
    isWinner: 'Is Winner?',
    calculateDelta: 'Calculate Delta',
    simulationResult: 'Simulation Result',
    eloDelta: 'Elo Delta',
    expectedWinRate: 'Expected Win Rate:',
    kFactor: 'K-Factor:',
    survivalWeight: 'Survival Weight:',
    streakWeight: 'Streak Weight:',
    perfWeight: 'Perf Weight:',
  },

  // ── Redis Browser ──
  redis: {
    title: 'Redis Browser',
    pattern: 'Pattern',
    search: 'Search',
    key: 'Key',
    type: 'Type',
    ttl: 'TTL (s)',
    actions: 'Actions',
    value: 'Value:',
    emptyUnsupported: '(Empty or Unsupported Type)',
    close: 'Close',
    confirmDelete: 'Delete key',
  },

  // ── Database Manager ──
  database: {
    title: 'User Management',
    uid: 'UID',
    level: 'Level',
    exp: 'Exp',
    rankScore: 'Rank Score',
    wins: 'Wins',
    actions: 'Actions',
    failedUpdate: 'Failed to update',
  },

  // ── Common ──
  common: {
    loading: 'Loading...',
    previous: 'Previous',
    next: 'Next',
    close: 'Close',
    search: 'Search',
  },
} as const;

export type AppMessages = typeof en;

const catalogs: Record<Locale, AppMessages> = { en };

export const currentLocale: Locale = 'en';

// t returns the message catalog for the active locale.
export function t(): AppMessages {
  return catalogs[currentLocale];
}

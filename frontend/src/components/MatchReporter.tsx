import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  ReportMatch,
  GetMatchByID,
  GetRequestLog,
  GetOpsIdentity,
} from '../../wailsjs/go/main/App';
import { models } from '../../wailsjs/go/models';
import { t } from '../i18n';

interface MemberForm {
  uuid: string;
  survival_time: number;
  kills: number;
  deaths: number;
  perf_tweak: number;
}

interface TeamForm {
  team_id: string;
  initial_count: number;
  alive_count: number;
  members: MemberForm[];
}

interface BatchResultItem {
  index: number;
  ok: boolean;
  matchId?: number;
  error?: string;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const MATCH_TYPE_RE = /^\d+(v\d+)+$/;
const PERF_MIN = 0.95;
const PERF_MAX = 1.05;

const newMember = (): MemberForm => ({
  uuid: '',
  survival_time: 0,
  kills: 0,
  deaths: 0,
  perf_tweak: 1.0,
});

const newTeam = (teamId: string): TeamForm => ({
  team_id: teamId,
  initial_count: 1,
  alive_count: 1,
  members: [newMember()],
});

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Prefer the server-provided after (contract v1.5.0); fall back to the
// server's floor formula max(0, before + delta) for older responses.
function participantAfter(p: models.ParticipantDetail): number {
  if (typeof p.rank_score_after === 'number' && !Number.isNaN(p.rank_score_after)) {
    return p.rank_score_after;
  }
  return Math.max(0, p.rank_score_before + p.rank_score_delta);
}

// ── field-level validation (blocks submission; messages are i18n English) ──

interface TeamFieldFlags {
  teamId: boolean;
  counts: boolean;
  members: { uuid: boolean; perf: boolean }[];
}

interface ValidationReport {
  messages: string[];
  matchType: boolean;
  times: boolean;
  teamFlags: TeamFieldFlags[]; // [winner, ...losers]
}

function validateTeam(team: TeamForm, isWinner: boolean, messages: string[]): TeamFieldFlags {
  const label = `${t().validation.teamPrefix} ${team.team_id || '?'}`;
  const flags: TeamFieldFlags = {
    teamId: team.team_id.trim() === '',
    counts: false,
    members: team.members.map(() => ({ uuid: false, perf: false })),
  };

  if (flags.teamId) {
    messages.push(t().validation.teamIdRequired);
  }
  if (team.initial_count < 1) {
    messages.push(`${label}: ${t().validation.initialCount}`);
    flags.counts = true;
  }
  if (team.alive_count < 0 || team.alive_count > team.initial_count) {
    messages.push(`${label}: ${t().validation.aliveRange}`);
    flags.counts = true;
  }
  if (isWinner && team.alive_count < 1) {
    messages.push(`${label}: ${t().validation.winnerAlive}`);
    flags.counts = true;
  }
  if (team.members.length > team.initial_count) {
    messages.push(`${label}: ${t().validation.memberCount}`);
    flags.counts = true;
  }

  team.members.forEach((m, i) => {
    const trimmed = m.uuid.trim();
    if (trimmed === '') {
      messages.push(`${label} #${i + 1}: ${t().validation.missingUuid}`);
      flags.members[i].uuid = true;
    } else if (!UUID_RE.test(trimmed)) {
      messages.push(`${label} #${i + 1}: ${t().validation.invalidUuid}`);
      flags.members[i].uuid = true;
    }
    if (!(m.perf_tweak >= PERF_MIN && m.perf_tweak <= PERF_MAX)) {
      messages.push(`${label} #${i + 1}: ${t().validation.perfRange}`);
      flags.members[i].perf = true;
    }
  });

  return flags;
}

function validateReport(
  matchType: string,
  durationSeconds: number,
  startedAt: string,
  finishedAt: string,
  winnerTeam: TeamForm,
  loserTeams: TeamForm[],
): ValidationReport {
  const messages: string[] = [];
  const report: ValidationReport = {
    messages,
    matchType: false,
    times: false,
    teamFlags: [],
  };

  if (!MATCH_TYPE_RE.test(matchType.trim())) {
    messages.push(t().validation.matchType);
    report.matchType = true;
  }

  const startTrim = startedAt.trim();
  const finishTrim = finishedAt.trim();
  let startMs: number | null = null;
  let finishMs: number | null = null;
  if (startTrim !== '') {
    startMs = Date.parse(startTrim);
    if (Number.isNaN(startMs)) {
      messages.push(t().validation.timeFormat);
      report.times = true;
      startMs = null;
    }
  }
  if (finishTrim !== '') {
    finishMs = Date.parse(finishTrim);
    if (Number.isNaN(finishMs)) {
      if (!report.times) messages.push(t().validation.timeFormat);
      report.times = true;
      finishMs = null;
    }
  }
  if (startMs !== null && finishMs !== null) {
    if (finishMs <= startMs) {
      messages.push(t().validation.timeOrder);
      report.times = true;
    } else if (durationSeconds > 0) {
      const diffSec = Math.round((finishMs - startMs) / 1000);
      if (Math.abs(diffSec - durationSeconds) > 1) {
        messages.push(t().validation.durationMismatch);
        report.times = true;
      }
    }
  }

  report.teamFlags.push(validateTeam(winnerTeam, true, messages));
  loserTeams.forEach((team) => report.teamFlags.push(validateTeam(team, false, messages)));

  const seen = new Set<string>();
  [winnerTeam, ...loserTeams].forEach((team) => {
    const id = team.team_id.trim();
    if (id === '') return;
    if (seen.has(id)) {
      messages.push(t().validation.duplicateTeamId);
    }
    seen.add(id);
  });

  if (loserTeams.length === 0) {
    messages.push(t().validation.needsLoser);
  }

  return report;
}

function buildTeamPayload(team: TeamForm): models.TeamReportInfo {
  return new models.TeamReportInfo({
    team_id: team.team_id,
    initial_count: team.initial_count,
    alive_count: team.alive_count,
    members: team.members
      .filter((m) => m.uuid.trim() !== '')
      .map(
        (m) =>
          new models.ParticipantReport({
            uuid: m.uuid.trim(),
            survival_time: m.survival_time,
            kills: m.kills,
            deaths: m.deaths,
            perf_tweak: m.perf_tweak,
          }),
      ),
  });
}

export default function MatchReporter() {
  // ── single-match form ──
  const [matchType, setMatchType] = useState('1v1');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState('');
  const [finishedAt, setFinishedAt] = useState('');
  const [winnerTeam, setWinnerTeam] = useState<TeamForm>(newTeam('A'));
  const [loserTeams, setLoserTeams] = useState<TeamForm[]>([newTeam('B')]);
  // source: game (real) / virtual (ops-fed test match). Both settle through the
  // same POST /api/matches path; only the source tag differs.
  const [source, setSource] = useState<'game' | 'virtual'>('game');
  // matchmaking_group_id: 0 = no party settlement; set to a formed group's ID
  // (from the Matchmaking page) to share rating deltas across a party.
  const [matchmakingGroupId, setMatchmakingGroupId] = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<models.Match | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── batch feed ──
  const [batchText, setBatchText] = useState('');
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  // ── OPS identity (B3) & request log (B4) ──
  const [ops, setOps] = useState<models.OpsIdentity | null>(null);
  const [requestLog, setRequestLog] = useState<models.RequestLogEntry[]>([]);

  // live field-level validation (recomputed on every edit)
  const validation = useMemo(
    () => validateReport(matchType, durationSeconds, startedAt, finishedAt, winnerTeam, loserTeams),
    [matchType, durationSeconds, startedAt, finishedAt, winnerTeam, loserTeams],
  );
  const valid = validation.messages.length === 0;

  useEffect(() => {
    GetOpsIdentity()
      .then(setOps)
      .catch(() => setOps(null));
    loadRequestLog();
  }, []);

  const loadRequestLog = async () => {
    try {
      setRequestLog(await GetRequestLog());
    } catch {
      // non-fatal: the log panel simply stays stale
    }
  };

  const updateWinner = (patch: Partial<TeamForm>) =>
    setWinnerTeam((prev) => ({ ...prev, ...patch }));

  const updateLoser = (index: number, patch: Partial<TeamForm>) =>
    setLoserTeams((prev) => prev.map((tm, i) => (i === index ? { ...tm, ...patch } : tm)));

  const addLoserTeam = () =>
    setLoserTeams((prev) => [...prev, newTeam(String.fromCharCode(65 + prev.length + 1))]);

  const removeLoserTeam = (index: number) =>
    setLoserTeams((prev) => prev.filter((_, i) => i !== index));

  const buildInput = (): models.TeamReportInput =>
    new models.TeamReportInput({
      match_type: matchType,
      winner_team: buildTeamPayload(winnerTeam),
      loser_teams: loserTeams.map(buildTeamPayload),
      duration_seconds: durationSeconds,
      source,
      matchmaking_group_id: matchmakingGroupId,
      started_at: startedAt.trim() || undefined,
      finished_at: finishedAt.trim() || undefined,
    });

  // Load a match detail into the result panel (success exit for batch rows).
  const viewMatch = async (id: number) => {
    setError(null);
    try {
      setResult(await GetMatchByID(id));
    } catch (err) {
      setError(errMsg(err));
    }
  };

  // Submit one match, then fetch the detail for participant settlement.
  const submitSingle = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const reported = await ReportMatch(buildInput());
      let detailed = reported;
      try {
        detailed = await GetMatchByID(reported.id);
      } catch {
        // Detail fetch failing is non-fatal: fall back to the report response.
      }
      setResult(detailed);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
      loadRequestLog();
    }
  };

  // Batch feed: loop over the same endpoint, one item at a time, with progress.
  const submitBatch = async () => {
    setBatchRunning(true);
    setBatchResults([]);
    setBatchError(null);
    setBatchProgress(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(batchText);
      } catch (e) {
        throw new Error(`${t().reporter.batchParseFailed}: ${errMsg(e)}`);
      }
      let items: unknown[];
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed && typeof parsed === 'object') {
        items = [parsed];
      } else {
        throw new Error(t().reporter.batchBadShape);
      }
      if (items.length === 0) {
        throw new Error(t().reporter.batchEmpty);
      }

      setBatchProgress({ done: 0, total: items.length });
      const results: BatchResultItem[] = [];
      for (let i = 0; i < items.length; i++) {
        setBatchProgress({ done: i, total: items.length });
        try {
          const input = new models.TeamReportInput(items[i]);
          const reported = await ReportMatch(input);
          results.push({ index: i + 1, ok: true, matchId: reported.id });
        } catch (err) {
          results.push({ index: i + 1, ok: false, error: errMsg(err) });
        }
        setBatchResults([...results]);
        setBatchProgress({ done: i + 1, total: items.length });
      }
    } catch (err) {
      setBatchError(errMsg(err));
    } finally {
      setBatchRunning(false);
      loadRequestLog();
    }
  };

  const batchDone = !batchRunning && batchResults.length > 0 && batchProgress !== null;
  const batchOkCount = batchResults.filter((r) => r.ok).length;
  const batchFailCount = batchResults.length - batchOkCount;

  const opsChip = () => {
    if (!ops) return null;
    if (ops.reporter_configured) {
      return <Chip size="small" color="success" label={t().ops.reporter} />;
    }
    if (ops.using_fallback) {
      return <Chip size="small" color="info" label={t().ops.fallback} />;
    }
    return <Chip size="small" color="error" label={t().ops.none} />;
  };

  const teamEditor = (
    team: TeamForm,
    flags: TeamFieldFlags,
    onChange: (patch: Partial<TeamForm>) => void,
    removable: boolean,
    onRemove?: () => void,
  ) => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          label="team_id"
          size="small"
          error={flags.teamId}
          value={team.team_id}
          onChange={(e) => onChange({ team_id: e.target.value })}
        />
        <TextField
          label="initial_count"
          size="small"
          type="number"
          error={flags.counts}
          value={team.initial_count}
          onChange={(e) => onChange({ initial_count: Number(e.target.value) })}
        />
        <TextField
          label="alive_count"
          size="small"
          type="number"
          error={flags.counts}
          value={team.alive_count}
          onChange={(e) => onChange({ alive_count: Number(e.target.value) })}
        />
        {removable && (
          <IconButton onClick={onRemove} color="error">
            <DeleteIcon />
          </IconButton>
        )}
      </Stack>

      {team.members.map((member, mi) => (
        <Stack key={mi} direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label={`Member ${mi + 1} UUID`}
            size="small"
            sx={{ minWidth: 300 }}
            error={flags.members[mi]?.uuid}
            value={member.uuid}
            onChange={(e) =>
              onChange({
                members: team.members.map((m, idx) => (idx === mi ? { ...m, uuid: e.target.value } : m)),
              })
            }
          />
          <TextField
            label="Survival (s)"
            size="small"
            type="number"
            sx={{ width: 110 }}
            value={member.survival_time}
            onChange={(e) =>
              onChange({
                members: team.members.map((m, idx) =>
                  idx === mi ? { ...m, survival_time: Number(e.target.value) } : m,
                ),
              })
            }
          />
          <TextField
            label="Kills"
            size="small"
            type="number"
            sx={{ width: 80 }}
            value={member.kills}
            onChange={(e) =>
              onChange({
                members: team.members.map((m, idx) => (idx === mi ? { ...m, kills: Number(e.target.value) } : m)),
              })
            }
          />
          <TextField
            label="Deaths"
            size="small"
            type="number"
            sx={{ width: 80 }}
            value={member.deaths}
            onChange={(e) =>
              onChange({
                members: team.members.map((m, idx) => (idx === mi ? { ...m, deaths: Number(e.target.value) } : m)),
              })
            }
          />
          <TextField
            label="perf"
            size="small"
            type="number"
            slotProps={{ htmlInput: { step: 0.01 } }}
            sx={{ width: 90 }}
            error={flags.members[mi]?.perf}
            value={member.perf_tweak}
            onChange={(e) =>
              onChange({
                members: team.members.map((m, idx) =>
                  idx === mi ? { ...m, perf_tweak: Number(e.target.value) } : m,
                ),
              })
            }
          />
          <IconButton
            size="small"
            color="error"
            disabled={team.members.length <= 1}
            onClick={() => onChange({ members: team.members.filter((_, idx) => idx !== mi) })}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => onChange({ members: [...team.members, newMember()] })}
      >
        {t().reporter.addMember}
      </Button>
    </Paper>
  );

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography variant="h4">{t().reporter.title}</Typography>
        {opsChip()}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t().reporter.intro}
        {ops && ops.upstream_url ? ` (${t().ops.upstream}: ${ops.upstream_url})` : ''}
      </Typography>

      {/* single report */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            {t().reporter.singleTitle}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <TextField
              label="match_type"
              size="small"
              error={validation.matchType}
              value={matchType}
              onChange={(e) => setMatchType(e.target.value)}
            />
            <TextField
              label="duration_seconds"
              size="small"
              type="number"
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
            />
            <TextField
              label="started_at (RFC3339, empty = now)"
              size="small"
              error={validation.times}
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
            />
            <TextField
              label="finished_at (RFC3339, empty = now)"
              size="small"
              error={validation.times}
              value={finishedAt}
              onChange={(e) => setFinishedAt(e.target.value)}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="reporter-source-label">{t().reporter.sourceLabel}</InputLabel>
              <Select
                labelId="reporter-source-label"
                label={t().reporter.sourceLabel}
                value={source}
                onChange={(e) => setSource(e.target.value as 'game' | 'virtual')}
              >
                <MenuItem value="game">{t().reporter.sourceGame}</MenuItem>
                <MenuItem value="virtual">{t().reporter.sourceVirtual}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={t().reporter.matchmakingGroupId}
              size="small"
              type="number"
              value={matchmakingGroupId}
              onChange={(e) => setMatchmakingGroupId(Number(e.target.value) || 0)}
              helperText={t().reporter.matchmakingGroupIdNote}
              sx={{ minWidth: 240 }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {t().reporter.sourceNote}
          </Typography>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t().reporter.winnerTeam}
          </Typography>
          {teamEditor(winnerTeam, validation.teamFlags[0] ?? { teamId: false, counts: false, members: [] }, updateWinner, false)}

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t().reporter.loserTeams}
          </Typography>
          {loserTeams.map((team, index) =>
            teamEditor(
              team,
              validation.teamFlags[index + 1] ?? { teamId: false, counts: false, members: [] },
              (patch) => updateLoser(index, patch),
              loserTeams.length > 1,
              () => removeLoserTeam(index),
            ),
          )}

          {!valid && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">{t().validation.summary}</Typography>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                {validation.messages.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </Alert>
          )}

          <Stack direction="row" spacing={2}>
            <Button startIcon={<AddIcon />} onClick={addLoserTeam} variant="outlined">
              {t().reporter.addLoserTeam}
            </Button>
            <Button
              startIcon={<SendIcon />}
              onClick={submitSingle}
              disabled={submitting || !valid}
              variant="contained"
            >
              {submitting ? t().reporter.submitting : t().reporter.submit}
            </Button>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {result && (
            <Box sx={{ mt: 2 }}>
              <Alert
                severity="success"
                sx={{ mb: 1 }}
                action={
                  <Button color="inherit" size="small" onClick={() => viewMatch(result.id)}>
                    {t().reporter.view}
                  </Button>
                }
              >
                {t().reporter.success} (ID: #{result.id}) — {t().reporter.source}={result.source}
                {result.winner_team_id ? `, ${t().reporter.winnerTeamLabel}=${result.winner_team_id}` : ''}
              </Alert>
              {result.participants && result.participants.length > 0 ? (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {[
                          t().table.uid,
                          t().table.team,
                          t().table.result,
                          t().table.before,
                          t().table.delta,
                          t().table.after,
                        ].map((h) => (
                          <TableCell key={h}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.participants.map((p) => (
                        <TableRow key={`${p.uid}-${p.team_id}`}>
                          <TableCell>{p.uid}</TableCell>
                          <TableCell>{p.team_id}</TableCell>
                          <TableCell>
                            <Chip
                              label={p.is_winner ? t().result.win : p.is_draw ? t().result.draw : t().result.lose}
                              size="small"
                              color={p.is_winner ? 'success' : p.is_draw ? 'default' : 'error'}
                            />
                          </TableCell>
                          <TableCell>{p.rank_score_before}</TableCell>
                          <TableCell sx={{ color: p.rank_score_delta >= 0 ? '#66bb6a' : '#ef5350' }}>
                            {p.rank_score_delta >= 0 ? '+' : ''}
                            {p.rank_score_delta}
                          </TableCell>
                          <TableCell>{participantAfter(p)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t().reporter.noParticipants}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* batch feed */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            {t().reporter.batchTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t().reporter.batchIntro}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={6}
            placeholder={t().reporter.batchPlaceholder}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />

          <Stack direction="row" spacing={2} sx={{ mt: 2, alignItems: 'center' }}>
            <Button
              startIcon={<SendIcon />}
              onClick={submitBatch}
              disabled={batchRunning || batchText.trim() === ''}
              variant="contained"
            >
              {batchRunning ? t().reporter.batchRunning : t().reporter.batchSubmit}
            </Button>
            {batchRunning && batchProgress && (
              <Typography variant="body2" color="text.secondary">
                {t().reporter.batchReporting} {batchProgress.done}/{batchProgress.total}…
              </Typography>
            )}
          </Stack>

          {batchError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {batchError}
            </Alert>
          )}

          {batchDone && (
            <Alert severity={batchFailCount === 0 ? 'success' : 'info'} sx={{ mt: 2 }}>
              {batchOkCount} {t().reporter.batchReported} · {batchFailCount} {t().reporter.batchFailed}
            </Alert>
          )}

          {batchResults.length > 0 && (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {[t().table.index, t().table.status, t().table.matchOrError, ''].map((h, i) => (
                      <TableCell key={i}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batchResults.map((r) => (
                    <TableRow key={r.index}>
                      <TableCell>{r.index}</TableCell>
                      <TableCell>
                        <Chip
                          label={r.ok ? t().status.success : t().status.failed}
                          size="small"
                          color={r.ok ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell>{r.ok ? `#${r.matchId}` : r.error}</TableCell>
                      <TableCell align="right">
                        {r.ok && r.matchId !== undefined && (
                          <Tooltip title={t().reporter.view}>
                            <IconButton size="small" onClick={() => viewMatch(r.matchId!)}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* request log (B4) */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" color="primary" sx={{ flexGrow: 1 }}>
              {t().reqlog.title}
            </Typography>
            <IconButton size="small" onClick={loadRequestLog} aria-label={t().reqlog.refresh}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Stack>
          {requestLog.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t().reqlog.empty}
            </Typography>
          ) : (
            <TableContainer component={Paper} sx={{ maxHeight: 280 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {[t().reqlog.time, t().reqlog.method, t().reqlog.path, t().reqlog.status, t().reqlog.code].map(
                      (h) => (
                        <TableCell key={h}>{h}</TableCell>
                      ),
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requestLog.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell>{entry.time}</TableCell>
                      <TableCell>{entry.method}</TableCell>
                      <TableCell>{entry.path}</TableCell>
                      <TableCell sx={{ color: entry.ok ? '#66bb6a' : '#ef5350' }}>
                        {entry.status === 0 ? 'unreachable' : entry.status}
                      </TableCell>
                      <TableCell>{entry.code || ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary">
        {t().reporter.eloNote}
      </Typography>
    </Box>
  );
}

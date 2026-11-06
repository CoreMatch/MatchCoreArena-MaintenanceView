import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  JoinMatchmaking,
  LeaveMatchmaking,
  GetMatchmakingStatus,
} from '../../wailsjs/go/main/App';
import { models } from '../../wailsjs/go/models';
import { t } from '../i18n';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const POLL_INTERVAL_MS = 5000;

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// "m:ss" elapsed since the RFC3339 timestamp (empty when unparseable).
function waitingFor(enqueuedAt: string, nowMs: number): string {
  const start = Date.parse(enqueuedAt);
  if (Number.isNaN(start)) return '';
  const sec = Math.max(0, Math.floor((nowMs - start) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MatchmakingPanel() {
  const [mode, setMode] = useState('1v1');
  const [status, setStatus] = useState<models.MatchmakingStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // ── party (sent as party_members; server matches the roster as one unit) ──
  const [partyInput, setPartyInput] = useState('');
  const [partyInputError, setPartyInputError] = useState(false);
  const [partyMembers, setPartyMembers] = useState<string[]>([]);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshStatus = async (silent = false) => {
    try {
      const st = await GetMatchmakingStatus();
      setStatus(st);
      if (!silent) setError(null);
    } catch (err) {
      if (!silent) setError(errMsg(err));
    }
  };

  // Queue status card: poll every 5s while the page is mounted,
  // plus a 1s tick so the waiting timer stays live.
  useEffect(() => {
    refreshStatus(true);
    pollTimer.current = setInterval(() => refreshStatus(true), POLL_INTERVAL_MS);
    const ticker = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      clearInterval(ticker);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const joinQueue = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const entry = await JoinMatchmaking(mode.trim(), partyMembers);
      setMessage(
        `${t().matchmaking.joined}: ${entry.match_type} (${t().matchmaking.rating} ${entry.rank_score})`,
      );
      await refreshStatus();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const leaveQueue = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await LeaveMatchmaking();
      setMessage(t().matchmaking.left);
      await refreshStatus();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const addPartyMember = () => {
    const trimmed = partyInput.trim();
    if (!UUID_RE.test(trimmed)) {
      setPartyInputError(true);
      return;
    }
    setPartyInputError(false);
    setPartyMembers((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setPartyInput('');
  };

  const removePartyMember = (index: number) =>
    setPartyMembers((prev) => prev.filter((_, i) => i !== index));

  const waiting = status?.in_queue && status.queue_entry ? waitingFor(status.queue_entry.enqueued_at, nowMs) : '';

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t().matchmaking.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t().matchmaking.intro}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label={t().matchmaking.mode}
              size="small"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            />
            <Button onClick={joinQueue} disabled={busy} variant="contained">
              {partyMembers.length > 0
                ? `${t().matchmaking.partyQueueAs} (${partyMembers.length})`
                : t().matchmaking.join}
            </Button>
            <Button onClick={leaveQueue} disabled={busy} variant="outlined">
              {t().matchmaking.leave}
            </Button>
            <IconButton onClick={() => refreshStatus(false)} aria-label={t().matchmaking.refresh}>
              <RefreshIcon />
            </IconButton>
          </Stack>

          {message && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {message}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* queue status card (polled) */}
          {status && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip
                  label={status.in_queue ? t().matchmaking.inQueue : t().matchmaking.notInQueue}
                  size="small"
                  color={status.in_queue ? 'warning' : 'default'}
                />
                {status.queue_entry && (
                  <Typography variant="body2" color="text.secondary">
                    {t().matchmaking.modeLabel} {status.queue_entry.match_type} ·{' '}
                    {t().matchmaking.rating} {status.queue_entry.rank_score}
                    {waiting !== '' && (
                      <>
                        {' '}
                        · {t().matchmaking.waiting}: {waiting}
                      </>
                    )}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  {t().matchmaking.autoRefresh}
                </Typography>
              </Stack>

              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t().matchmaking.recentGroups}
              </Typography>
              {!status.recent_groups || status.recent_groups.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t().matchmaking.noGroups}
                </Typography>
              ) : (
                status.recent_groups.map((g) => (
                  <Paper key={g.group_id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                    <Typography variant="body2">
                      {t().matchmaking.group} #{g.group_id} · {g.match_type} · {t().matchmaking.formedAt}{' '}
                      {g.formed_at}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(g.members || [])
                        .map((m) => `${t().table.team} ${m.team_id}: uid ${m.uid} (${m.rank_score})`)
                        .join('  |  ')}
                    </Typography>
                  </Paper>
                ))
              )}
            </Paper>
          )}
        </CardContent>
      </Card>

      {/* party fields: UUID roster sent as party_members to the server */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            {t().matchmaking.partyTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t().matchmaking.partyNote}
          </Typography>

          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label={t().matchmaking.partyPlaceholder}
              size="small"
              sx={{ minWidth: 320 }}
              error={partyInputError}
              helperText={partyInputError ? t().matchmaking.partyInvalidUuid : ''}
              value={partyInput}
              onChange={(e) => {
                setPartyInput(e.target.value);
                setPartyInputError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addPartyMember();
              }}
            />
            <Button startIcon={<AddIcon />} onClick={addPartyMember} variant="outlined">
              {t().matchmaking.partyAdd}
            </Button>
            <Typography variant="body2" color="text.secondary">
              {t().matchmaking.partySize}: {partyMembers.length}
            </Typography>
          </Stack>

          {partyMembers.length > 0 && (
            <Box sx={{ mt: 2 }}>
              {partyMembers.map((uuid, i) => (
                <Stack key={uuid} direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {uuid}
                  </Typography>
                  <IconButton size="small" color="error" onClick={() => removePartyMember(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

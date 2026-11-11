import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { GetMatchAssignment } from '../../wailsjs/go/main/App';
import { models } from '../../wailsjs/go/models';
import { t } from '../i18n';

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// join_target is omitted when the server has no game-server address configured.
function joinTargetText(target?: models.JoinTarget): string {
  if (!target || !target.host) return '—';
  return `${target.host}:${target.port}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 180 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

export default function AssignmentInspector() {
  const [uuid, setUuid] = useState('');
  const [result, setResult] = useState<models.MatchAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queriedUuid, setQueriedUuid] = useState('');

  const trimmed = uuid.trim();

  const lookup = async () => {
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setQueriedUuid(trimmed);
    try {
      setResult(await GetMatchAssignment(trimmed));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t().assignment.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t().assignment.intro}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label={t().assignment.uuid}
              size="small"
              sx={{ minWidth: 360 }}
              value={uuid}
              onChange={(e) => setUuid(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') lookup();
              }}
              helperText={trimmed ? '' : t().assignment.emptyInput}
            />
            <Button
              startIcon={<SearchIcon />}
              onClick={lookup}
              disabled={busy || !trimmed}
              variant="contained"
            >
              {busy ? t().assignment.lookingUp : t().assignment.lookup}
            </Button>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {result && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip
                  label={result.assigned ? t().assignment.assigned : t().assignment.notAssigned}
                  size="small"
                  color={result.assigned ? 'success' : 'default'}
                />
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  {queriedUuid}
                </Typography>
              </Stack>

              {!result.assigned && (
                <Alert severity={result.reason ? 'warning' : 'info'} sx={{ mt: 2 }}>
                  {result.reason === 'no_room_available'
                    ? t().assignment.noRoomAvailable
                    : t().assignment.noAssignment}
                </Alert>
              )}

              {result.reason && (
                <Box sx={{ mt: 1 }}>
                  <Field label={t().assignment.reason} value={result.reason} />
                </Box>
              )}

              {result.assigned && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', rowGap: 2 }}>
                    <Field label={t().assignment.groupId} value={String(result.group_id ?? '')} />
                    <Field label={t().assignment.matchType} value={result.match_type ?? ''} />
                    <Field label={t().assignment.formedAt} value={result.formed_at ?? ''} />
                    <Field label={t().assignment.teamId} value={result.team_id ?? ''} />
                    <Field label={t().assignment.room} value={result.room ?? ''} />
                    <Field label={t().assignment.joinTarget} value={joinTargetText(result.join_target)} />
                  </Stack>
                </>
              )}
            </Paper>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            {t().assignment.readOnlyNote}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

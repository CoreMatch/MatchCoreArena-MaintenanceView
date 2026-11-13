import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  OpenInNew as OpenIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { GetSeasons, RollSeason } from '../../wailsjs/go/main/App';
import { models } from '../../wailsjs/go/models';
import { t } from '../i18n';

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default function SeasonsView() {
  const [seasons, setSeasons] = useState<models.SeasonRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // roll form
  const [targetSeason, setTargetSeason] = useState(0);
  const [resetScores, setResetScores] = useState(false);
  const [note, setNote] = useState('');
  const [rolling, setRolling] = useState(false);
  const [rollResult, setRollResult] = useState<{ success: boolean; season: number; resetScores: boolean; openedAt: string } | null>(null);
  const [rollErr, setRollErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const list = await GetSeasons();
      setSeasons(list ?? []);
    } catch (err) {
      setLoadErr(errMsg(err));
      setSeasons(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    load();
  }, [load]);

  // When seasons load, auto-fill targetSeason = current + 1
  useEffect(() => {
    if (seasons && seasons.length > 0) {
      setTargetSeason(seasons[0].season + 1);
    }
  }, [seasons]);

  const handleRoll = async () => {
    setRolling(true);
    setRollErr(null);
    setRollResult(null);
    try {
      const rec = await RollSeason({
        target_season: targetSeason,
        reset_scores: resetScores,
        note,
      });
      setRollResult({
        success: true,
        season: rec.season,
        resetScores: rec.reset_scores,
        openedAt: rec.opened_at,
      });
      setNote('');
      setResetScores(false);
      await load(); // refresh list
    } catch (err) {
      setRollErr(errMsg(err));
    } finally {
      setRolling(false);
    }
  };

  const noteOver = note.length > 200;
  const currentSeason = seasons && seasons.length > 0 ? seasons[0].season : null;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t().seasons.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t().seasons.intro}
      </Typography>

      {/* Season history */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">{t().seasons.listTitle}</Typography>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={load}
              disabled={loading}
            >
              {loading ? t().seasons.loading : t().seasons.load}
            </Button>
          </Stack>

          {loadErr && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {loadErr}
            </Alert>
          )}

          {seasons && seasons.length === 0 && !loadErr && (
            <Alert severity="info">{t().seasons.empty}</Alert>
          )}

          {seasons && seasons.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#{t().table.season}</TableCell>
                  <TableCell>{t().seasons.currentSeason}</TableCell>
                  <TableCell>{t().seasons.resetScores}</TableCell>
                  <TableCell>{t().seasons.openedAt}</TableCell>
                  <TableCell>{t().seasons.openedBy}</TableCell>
                  <TableCell>{t().seasons.note}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {seasons.map((s, idx) => (
                  <TableRow key={s.season}>
                    <TableCell>{s.season}</TableCell>
                    <TableCell>
                      {idx === 0 ? (
                        <Chip
                          size="small"
                          label={t().seasons.currentSeason}
                          color="primary"
                          variant="outlined"
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{s.reset_scores ? '✓' : '—'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {s.opened_at}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {s.opened_by}
                    </TableCell>
                    <TableCell sx={{ fontStyle: s.note ? 'normal' : 'italic', color: s.note ? 'inherit' : 'text.secondary' }}>
                      {s.note || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rollover form */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {t().seasons.rollTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t().seasons.rollIntro}
          </Typography>

          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={3} sx={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {t().seasons.targetSeason}
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {currentSeason !== null ? `${currentSeason} + 1 = ${currentSeason + 1}` : 'loading...'}
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  value={targetSeason}
                  onChange={(e) => setTargetSeason(parseInt(e.target.value, 10) || 0)}
                  sx={{ mt: 1, width: 120 }}
                  error={currentSeason !== null && targetSeason !== currentSeason + 1}
                  helperText={currentSeason !== null && targetSeason !== currentSeason + 1 ? 'must equal current + 1' : ''}
                />
              </Box>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={resetScores}
                    onChange={(e) => setResetScores(e.target.checked)}
                  />
                }
                label={t().seasons.resetScoresLabel}
                sx={{ alignItems: 'flex-start' }}
              />
            </Stack>

            <TextField
              size="small"
              fullWidth
              label={t().seasons.noteLabel}
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              error={noteOver}
              helperText={noteOver ? `Note is ${note.length}/200` : `${note.length}/200`}
              sx={{ mt: 2 }}
            />

            <Stack direction="row" spacing={2} sx={{ mt: 2, alignItems: 'center' }}>
              <Button
                variant="contained"
                startIcon={<OpenIcon />}
                onClick={handleRoll}
                disabled={
                  rolling ||
                  (currentSeason !== null && targetSeason !== currentSeason + 1) ||
                  targetSeason <= 0
                }
              >
                {rolling ? t().seasons.submitting : t().seasons.submit}
              </Button>
            </Stack>

            {rollErr && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {rollErr}
              </Alert>
            )}
            {rollResult?.success && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {t().seasons.success} {rollResult.season}
                {rollResult.resetScores ? ' (scores reset)' : ''} — opened at{' '}
                <span style={{ fontFamily: 'monospace' }}>{rollResult.openedAt}</span>
              </Alert>
            )}
          </Paper>
        </CardContent>
      </Card>
    </Box>
  );
}

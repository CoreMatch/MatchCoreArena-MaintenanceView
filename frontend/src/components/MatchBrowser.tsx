import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
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
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  ListMatches,
  GetMatchByGameID,
  GetMatchRejections,
  GetMatchByID,
} from '../../wailsjs/go/main/App';
import { models } from '../../wailsjs/go/models';
import { t } from '../i18n';

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Prefer the server-provided after (contract v1.5.0); fall back to the
// server's floor formula for older responses that omit it.
function participantAfter(p: models.ParticipantDetail): number {
  if (typeof p.rank_score_after === 'number' && !Number.isNaN(p.rank_score_after)) {
    return p.rank_score_after;
  }
  return Math.max(0, p.rank_score_before + p.rank_score_delta);
}

// Settlement table shared by the list drill-down and the game_id lookup.
function SettlementTable({ match }: { match: models.Match }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {t('browser.detail.match')} #{match.id} · {match.match_type} · {t('reporter.source')}={match.source}
        {match.map_name ? ` · ${t('browser.filter.map')}=${match.map_name}` : ''}
        {match.game_id ? ` · ${t('table.gameId')}=${match.game_id}` : ''}
        {match.winner_team_id
          ? ` · ${t('table.winner')}=${match.winner_team_id}`
          : ` · ${t('table.winner')}=${t('result.draw')}`}
        {' · '}
        {t('table.finishedAt')}: {match.finished_at}
      </Typography>
      {match.participants && match.participants.length > 0 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {[
                  t('table.uid'),
                  t('table.team'),
                  t('table.result'),
                  t('table.before'),
                  t('table.delta'),
                  t('table.after'),
                ].map((h) => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {match.participants.map((p) => (
                <TableRow key={`${p.uid}-${p.team_id}`}>
                  <TableCell>{p.uid}</TableCell>
                  <TableCell>{p.team_id}</TableCell>
                  <TableCell>
                    <Chip
                      label={p.is_winner ? t('result.win') : p.is_draw ? t('result.draw') : t('result.lose')}
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
          {t('reporter.noParticipants')}
        </Typography>
      )}
    </Box>
  );
}

export default function MatchBrowser() {
  // ── global list ──
  const [source, setSource] = useState('');
  const [mapName, setMapName] = useState('');
  const [gameIdFilter, setGameIdFilter] = useState('');
  const [uidText, setUidText] = useState('');
  const [finishedFrom, setFinishedFrom] = useState('');
  const [finishedTo, setFinishedTo] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [pageNum, setPageNum] = useState(1);

  const [rows, setRows] = useState<models.Match[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<models.Match | null>(null);

  // ── game_id lookup ──
  const [lookupId, setLookupId] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // ── rejections ──
  const [rejections, setRejections] = useState<models.RejectionRecord[] | null>(null);
  const [rejectionsLoading, setRejectionsLoading] = useState(false);
  const [rejectionsError, setRejectionsError] = useState<string | null>(null);

  const queryPage = async (targetPage: number) => {
    setListLoading(true);
    setListError(null);
    try {
      const uidNum = uidText.trim() === '' ? 0 : Number(uidText);
      if (uidText.trim() !== '' && (!Number.isFinite(uidNum) || uidNum <= 0)) {
        throw new Error(t('rankings.history.invalidUid'));
      }
      const q = new models.MatchListQuery({
        source: source.trim(),
        map_name: mapName.trim(),
        game_id: gameIdFilter.trim(),
        uid: uidNum,
        finished_from: finishedFrom.trim(),
        finished_to: finishedTo.trim(),
        page_num: targetPage,
        page_size: pageSize,
      });
      const matches = await ListMatches(q);
      setRows(matches);
      setPageNum(targetPage);
    } catch (err) {
      setListError(errMsg(err));
    } finally {
      setListLoading(false);
    }
  };

  // Drill-down: list entries already carry detail shape; refetch only if
  // participants are missing.
  const openMatch = async (m: models.Match) => {
    setSelected(m);
    if (!m.participants || m.participants.length === 0) {
      try {
        setSelected(await GetMatchByID(m.id));
      } catch {
        // keep the row as-is; the panel shows the "no details" note
      }
    }
  };

  const lookup = async () => {
    const id = lookupId.trim();
    if (id === '') {
      setLookupError(t('browser.lookup.empty'));
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    try {
      const m = await GetMatchByGameID(id);
      setSelected(m);
    } catch (err) {
      setLookupError(errMsg(err));
    } finally {
      setLookupLoading(false);
    }
  };

  const loadRejections = async () => {
    setRejectionsLoading(true);
    setRejectionsError(null);
    try {
      const records = await GetMatchRejections();
      // server returns oldest first; show newest first
      setRejections([...records].reverse());
    } catch (err) {
      setRejectionsError(errMsg(err));
    } finally {
      setRejectionsLoading(false);
    }
  };

  const nextEnabled = rows !== null && rows.length === pageSize;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('browser.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('browser.intro')}
      </Typography>

      {/* global list */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            {t('browser.list.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('browser.list.intro')}
          </Typography>

          <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <TextField
              label={t('browser.filter.source')}
              size="small"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <TextField
              label={t('browser.filter.map')}
              size="small"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
            />
            <TextField
              label={t('browser.filter.gameId')}
              size="small"
              value={gameIdFilter}
              onChange={(e) => setGameIdFilter(e.target.value)}
            />
            <TextField
              label={t('browser.filter.uid')}
              size="small"
              type="number"
              value={uidText}
              onChange={(e) => setUidText(e.target.value)}
            />
            <TextField
              label={t('browser.filter.from')}
              size="small"
              value={finishedFrom}
              onChange={(e) => setFinishedFrom(e.target.value)}
            />
            <TextField
              label={t('browser.filter.to')}
              size="small"
              value={finishedTo}
              onChange={(e) => setFinishedTo(e.target.value)}
            />
            <TextField
              label={t('browser.pageSize')}
              size="small"
              type="number"
              sx={{ width: 110 }}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            />
            <Button
              startIcon={<SearchIcon />}
              onClick={() => queryPage(1)}
              disabled={listLoading}
              variant="contained"
            >
              {listLoading ? t('browser.loading') : t('browser.load')}
            </Button>
          </Stack>

          {listError && <Alert severity="error">{listError}</Alert>}

          {rows && (
            <Box>
              {rows.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('browser.empty')}
                </Typography>
              ) : (
                <TableContainer component={Paper} sx={{ mb: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {[
                          'ID',
                          t('table.type'),
                          t('table.sourceCol'),
                          t('browser.filter.map'),
                          t('table.gameId'),
                          t('table.winner'),
                          t('table.finishedAt'),
                        ].map((h) => (
                          <TableCell key={h}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((m) => (
                        <TableRow
                          key={m.id}
                          hover
                          selected={selected?.id === m.id}
                          onClick={() => openMatch(m)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>#{m.id}</TableCell>
                          <TableCell>{m.match_type}</TableCell>
                          <TableCell>{m.source}</TableCell>
                          <TableCell>{m.map_name || '-'}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{m.game_id || '-'}</TableCell>
                          <TableCell>{m.winner_team_id || t('result.draw')}</TableCell>
                          <TableCell>{m.finished_at}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <IconButton size="small" disabled={pageNum <= 1 || listLoading} onClick={() => queryPage(pageNum - 1)}>
                  <PrevIcon />
                </IconButton>
                <Typography variant="body2" color="text.secondary">
                  {t('browser.page')} {pageNum}
                </Typography>
                <IconButton size="small" disabled={!nextEnabled || listLoading} onClick={() => queryPage(pageNum + 1)}>
                  <NextIcon />
                </IconButton>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* game_id lookup */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            {t('browser.lookup.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('browser.lookup.intro')}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label={t('table.gameId')}
              size="small"
              sx={{ minWidth: 320 }}
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') lookup();
              }}
            />
            <Button
              startIcon={<SearchIcon />}
              onClick={lookup}
              disabled={lookupLoading}
              variant="contained"
            >
              {lookupLoading ? t('browser.loading') : t('browser.lookup.button')}
            </Button>
          </Stack>
          {lookupError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {lookupError}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* settlement detail (drill-down target) */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            {t('browser.detail.title')}
          </Typography>
          {selected ? (
            <SettlementTable match={selected} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('browser.detail.hint')}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* rejections */}
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" color="primary" sx={{ flexGrow: 1 }}>
              {t('browser.rejections.title')}
            </Typography>
            <Tooltip title={t('browser.rejections.refresh')}>
              <IconButton size="small" onClick={loadRejections} aria-label={t('browser.rejections.refresh')}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('browser.rejections.note')}
          </Alert>

          {rejectionsError && <Alert severity="error">{rejectionsError}</Alert>}

          {rejections &&
            (rejections.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('browser.rejections.empty')}
              </Typography>
            ) : (
              <TableContainer component={Paper} sx={{ maxHeight: 320 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {[t('reqlog.time'), t('reqlog.code'), t('table.gameId'), t('table.reason')].map((h) => (
                        <TableCell key={h}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rejections.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.time}</TableCell>
                        <TableCell>
                          <Chip
                            label={r.code}
                            size="small"
                            color={r.code === 'mca_game_id_conflict' ? 'warning' : 'error'}
                          />
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{r.game_id || '-'}</TableCell>
                        <TableCell>{r.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ))}
        </CardContent>
      </Card>
    </Box>
  );
}

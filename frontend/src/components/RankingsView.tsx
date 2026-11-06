import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { GetTopRankings, GetPlayerHistory } from '../../wailsjs/go/main/App';
import { models } from '../../wailsjs/go/models';
import { t } from '../i18n';

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function scoreAfter(before: number, delta: number): number {
  return Math.max(0, before + delta);
}

export default function RankingsView() {
  // ── rankings ──
  const [rankType, setRankType] = useState('1v1');
  const [limit, setLimit] = useState(100);
  const [rankings, setRankings] = useState<models.Ranking[] | null>(null);
  const [rankError, setRankError] = useState<string | null>(null);
  const [rankLoading, setRankLoading] = useState(false);

  // ── player history ──
  const [uidText, setUidText] = useState('');
  const [historyLimit, setHistoryLimit] = useState(50);
  const [history, setHistory] = useState<models.PlayerMatchRow[] | null>(null);
  const [historyUid, setHistoryUid] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadRankings = async () => {
    setRankLoading(true);
    setRankError(null);
    try {
      const rows = await GetTopRankings(rankType.trim(), limit);
      setRankings(rows);
    } catch (err) {
      setRankError(errMsg(err));
    } finally {
      setRankLoading(false);
    }
  };

  const loadHistory = async () => {
    const uid = Number(uidText);
    if (!Number.isFinite(uid) || uid <= 0) {
      setHistoryError(t().rankings.historyInvalidUid);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await GetPlayerHistory(uid, historyLimit);
      setHistory(rows);
      setHistoryUid(uid);
    } catch (err) {
      setHistoryError(errMsg(err));
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t().rankings.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t().rankings.intro}
      </Typography>

      {/* rankings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            {t().rankings.topTitle}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label="rank_type"
              size="small"
              value={rankType}
              onChange={(e) => setRankType(e.target.value)}
            />
            <TextField
              label={t().rankings.limit}
              size="small"
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
            <Button
              startIcon={<SearchIcon />}
              onClick={loadRankings}
              disabled={rankLoading}
              variant="contained"
            >
              {rankLoading ? t().rankings.topLoading : t().rankings.topLoad}
            </Button>
          </Stack>

          {rankError && <Alert severity="error">{rankError}</Alert>}

          {rankings &&
            (rankings.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t().rankings.topEmpty}
              </Typography>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {[
                        t().table.rank,
                        t().table.player,
                        t().table.type,
                        t().table.score,
                        t().table.season,
                        t().table.updatedAt,
                      ].map((h) => (
                        <TableCell key={h}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rankings.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.rank_position}</TableCell>
                        <TableCell>
                          {r.user_uid !== 0 ? `uid ${r.user_uid}` : r.user_uuid || '-'}
                        </TableCell>
                        <TableCell>{r.rank_type}</TableCell>
                        <TableCell>{r.score}</TableCell>
                        <TableCell>{r.season}</TableCell>
                        <TableCell>{r.updated_at}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ))}
        </CardContent>
      </Card>

      {/* player history */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            {t().rankings.historyTitle}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label={t().rankings.historyUid}
              size="small"
              type="number"
              value={uidText}
              onChange={(e) => setUidText(e.target.value)}
            />
            <TextField
              label={t().rankings.historyCount}
              size="small"
              type="number"
              value={historyLimit}
              onChange={(e) => setHistoryLimit(Number(e.target.value))}
            />
            <Button
              startIcon={<SearchIcon />}
              onClick={loadHistory}
              disabled={historyLoading}
              variant="contained"
            >
              {historyLoading ? t().rankings.historyLoading : t().rankings.historyLoad}
            </Button>
          </Stack>

          {historyError && <Alert severity="error">{historyError}</Alert>}

          {history &&
            historyUid !== null &&
            (history.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t().rankings.historyPlayer} {historyUid} {t().rankings.historyEmpty}
              </Typography>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {[
                        t().table.match,
                        t().table.type,
                        t().table.sourceCol,
                        t().table.team,
                        t().table.result,
                        t().table.before,
                        t().table.delta,
                        t().table.after,
                        t().table.time,
                      ].map((h) => (
                        <TableCell key={h}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((row) => (
                      <TableRow key={`${row.match_id}-${row.team_id}`}>
                        <TableCell>#{row.match_id}</TableCell>
                        <TableCell>{row.match_type}</TableCell>
                        <TableCell>{row.source}</TableCell>
                        <TableCell>{row.team_id}</TableCell>
                        <TableCell>
                          <Chip
                            label={
                              row.is_winner ? t().result.win : row.is_draw ? t().result.draw : t().result.lose
                            }
                            size="small"
                            color={row.is_winner ? 'success' : row.is_draw ? 'default' : 'error'}
                          />
                        </TableCell>
                        <TableCell>{row.rank_score_before}</TableCell>
                        <TableCell sx={{ color: row.rank_score_delta >= 0 ? '#66bb6a' : '#ef5350' }}>
                          {row.rank_score_delta >= 0 ? '+' : ''}
                          {row.rank_score_delta}
                        </TableCell>
                        <TableCell>{scoreAfter(row.rank_score_before, row.rank_score_delta)}</TableCell>
                        <TableCell>{row.finished_at}</TableCell>
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

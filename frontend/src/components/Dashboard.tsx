import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Link } from '@mui/material';
import { Assessment, Groups, Language, People } from '@mui/icons-material';
import { GetConfig, GetMetrics, GetSystemStats } from '../../wailsjs/go/main/App';
import { models } from '../../wailsjs/go/models';
import { t } from '../i18n';

// Placeholder for data we do not actually have: never render a fabricated 0.
const UNKNOWN = '\u2014';

export default function Dashboard() {
  const [config, setConfig] = useState<models.Config | null>(null);
  const [stats, setStats] = useState<models.SystemStats | null>(null);
  const [metrics, setMetrics] = useState<models.MetricsSnapshot | null>(null);
  const [metricsError, setMetricsError] = useState(false);

  useEffect(() => {
    GetConfig().then(setConfig);
    GetSystemStats().then(setStats).catch(console.error);
    GetMetrics()
      .then(setMetrics)
      .catch((err) => {
        console.error(err);
        setMetricsError(true);
      });
  }, []);

  const inQueue =
    metrics === null
      ? null
      : Object.values(metrics.queue_depth || {}).reduce((sum, depth) => sum + depth, 0);

  const matchesReported =
    metrics === null ? null : (metrics.counters?.['matches_reported_total'] ?? 0);

  const statCards = [
    {
      title: t().dashboard.totalUsers,
      value: stats === null ? UNKNOWN : stats.total_users.toLocaleString(),
      icon: <People color="primary" />,
    },
    {
      title: t().dashboard.inQueue,
      value: inQueue === null ? UNKNOWN : inQueue.toLocaleString(),
      icon: <Groups color="primary" />,
    },
    {
      title: t().dashboard.matchesReported,
      value: matchesReported === null ? UNKNOWN : matchesReported.toLocaleString(),
      icon: <Assessment color="primary" />,
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t().dashboard.title}
      </Typography>

      <Grid container spacing={3} component="div">
        {/* Config Info */}
        <Grid size={{ xs: 12 }} component="div">
          <Card sx={{ bgcolor: 'rgba(233, 69, 96, 0.1)', border: '1px solid #e94560' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
              <Language sx={{ mr: 2, color: '#e94560' }} />
              <Box>
                <Typography variant="subtitle2" color="textSecondary">{t().dashboard.upstreamServer}</Typography>
                <Typography variant="body1">
                  <Link href={config?.upstream_url} target="_blank" color="primary">
                    {config?.upstream_url || t().dashboard.loading}
                  </Link>
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {statCards.map((stat) => (
          <Grid size={{ xs: 12, sm: 4 }} key={stat.title} component="div">
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ mr: 2 }}>
                  {stat.icon}
                </Box>
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    {stat.title}
                  </Typography>
                  <Typography variant="h5">
                    {stat.value}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {metricsError && (
          <Grid size={{ xs: 12 }} component="div">
            <Typography variant="body2" color="textSecondary">
              {t().dashboard.metricsUnavailable}
            </Typography>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

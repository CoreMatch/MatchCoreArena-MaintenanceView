import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Link } from '@mui/material';
import { Storage, People, SportsEsports, Language } from '@mui/icons-material';
import { GetConfig, GetSystemStats } from '../../wailsjs/go/main/App';

export default function Dashboard() {
  const [config, setConfig] = useState<any>(null);
  const [stats, setStats] = useState<any>({
    total_users: 0,
    active_matches: 0,
    redis_keys: 0
  });

  useEffect(() => {
    GetConfig().then(setConfig);
    GetSystemStats().then(setStats).catch(console.error);
  }, []);

  const statCards = [
    { title: 'Total Users', value: stats.total_users.toLocaleString(), icon: <People color="primary" /> },
    { title: 'Active Matches', value: stats.active_matches.toLocaleString(), icon: <SportsEsports color="primary" /> },
    { title: 'Redis Keys', value: stats.redis_keys.toLocaleString(), icon: <Storage color="primary" /> },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Overview
      </Typography>
      
      <Grid container spacing={3} component="div">
        {/* Config Info */}
        <Grid size={{ xs: 12 }} component="div">
          <Card sx={{ bgcolor: 'rgba(233, 69, 96, 0.1)', border: '1px solid #e94560' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
              <Language sx={{ mr: 2, color: '#e94560' }} />
              <Box>
                <Typography variant="subtitle2" color="textSecondary">Upstream Server</Typography>
                <Typography variant="body1">
                  <Link href={config?.upstream_url} target="_blank" color="primary">
                    {config?.upstream_url || 'Loading...'}
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
      </Grid>
    </Box>
  );
}

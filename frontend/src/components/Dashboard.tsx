import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Link } from '@mui/material';
import { Storage, People, SportsEsports, Language } from '@mui/icons-material';
import { GetConfig } from '../../wailsjs/go/main/App';

export default function Dashboard() {
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    GetConfig().then(setConfig);
  }, []);

  const stats = [
    { title: 'Total Users', value: '1,234', icon: <People color="primary" /> },
    { title: 'Active Matches', value: '42', icon: <SportsEsports color="primary" /> },
    { title: 'Redis Keys', value: '156', icon: <Storage color="primary" /> },
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

        {stats.map((stat) => (
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

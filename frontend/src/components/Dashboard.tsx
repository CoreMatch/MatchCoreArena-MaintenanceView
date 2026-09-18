import { Box, Typography, Grid, Card, CardContent } from '@mui/material';
import { Storage, People, SportsEsports } from '@mui/icons-material';

export default function Dashboard() {
  const stats = [
    { title: 'Total Users', value: '1,234', icon: <People color="primary" />, color: '#4caf50' },
    { title: 'Active Matches', value: '42', icon: <SportsEsports color="primary" />, color: '#2196f3' },
    { title: 'Redis Keys', value: '156', icon: <Storage color="primary" />, color: '#ff9800' },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Overview
      </Typography>
      <Grid container spacing={3}>
        {stats.map((stat) => (
          <Grid item xs={12} sm={4} key={stat.title}>
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

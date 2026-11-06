import { useState } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  TextField, 
  Button, 
  Card, 
  CardContent,
  FormControlLabel,
  Switch,
  Divider
} from '@mui/material';
import { SimulateRating } from '../../wailsjs/go/main/App';
import { t } from '../i18n';

export default function RatingSimulator() {
  const [input, setInput] = useState({
    player_rating: 1000,
    opponent_rating: 1000,
    wins_count: 5,
    survivor_count: 2,
    initial_count: 4,
    streak: 0,
    performance: 1.0,
    is_winner: true
  });

  const [result, setResult] = useState<any>(null);

  const handleSimulate = async () => {
    try {
      const res = await SimulateRating(input);
      setResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setInput(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : parseFloat(value)
    }));
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t().rating.title}
      </Typography>
      
      <Grid container spacing={3} component="div">
        <Grid size={{ xs: 12, md: 6 }} component="div">
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>{t().rating.inputParams}</Typography>
              <Grid container spacing={2} component="div">
                <Grid size={{ xs: 6 }} component="div">
                  <TextField 
                    fullWidth label={t().rating.playerRating} name="player_rating" 
                    type="number" value={input.player_rating} onChange={handleChange} 
                  />
                </Grid>
                <Grid size={{ xs: 6 }} component="div">
                  <TextField 
                    fullWidth label={t().rating.opponentRating} name="opponent_rating" 
                    type="number" value={input.opponent_rating} onChange={handleChange} 
                  />
                </Grid>
                <Grid size={{ xs: 6 }} component="div">
                  <TextField 
                    fullWidth label={t().rating.winsCount} name="wins_count" 
                    type="number" value={input.wins_count} onChange={handleChange} 
                  />
                </Grid>
                <Grid size={{ xs: 6 }} component="div">
                  <TextField 
                    fullWidth label={t().rating.streak} name="streak" 
                    type="number" value={input.streak} onChange={handleChange} 
                  />
                </Grid>
                <Grid size={{ xs: 6 }} component="div">
                  <TextField 
                    fullWidth label={t().rating.survivors} name="survivor_count" 
                    type="number" value={input.survivor_count} onChange={handleChange} 
                  />
                </Grid>
                <Grid size={{ xs: 6 }} component="div">
                  <TextField 
                    fullWidth label={t().rating.teamSize} name="initial_count" 
                    type="number" value={input.initial_count} onChange={handleChange} 
                  />
                </Grid>
                <Grid size={{ xs: 6 }} component="div">
                  <TextField 
                    fullWidth label={t().rating.performance} name="performance" 
                    type="number" value={input.performance} onChange={handleChange} 
                    slotProps={{ htmlInput: { step: 0.01 } }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }} component="div">
                  <FormControlLabel
                    control={<Switch checked={input.is_winner} onChange={handleChange} name="is_winner" />}
                    label={t().rating.isWinner}
                  />
                </Grid>
                <Grid size={{ xs: 12 }} component="div">
                  <Button variant="contained" fullWidth onClick={handleSimulate}>
                    {t().rating.calculateDelta}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }} component="div">
          {result && (
            <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main' }}>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>{t().rating.simulationResult}</Typography>
                <Box sx={{ textAlign: 'center', my: 2 }}>
                  <Typography variant="h2" color={result.delta >= 0 ? 'success.main' : 'error.main'}>
                    {result.delta >= 0 ? `+${result.delta}` : result.delta}
                  </Typography>
                  <Typography color="textSecondary">{t().rating.eloDelta}</Typography>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Grid container spacing={1} component="div">
                  <Grid size={{ xs: 8 }} component="div"><Typography variant="body2">{t().rating.expectedWinRate}</Typography></Grid>
                  <Grid size={{ xs: 4 }} component="div"><Typography variant="body2" align="right">{(result.expected_win_rate * 100).toFixed(2)}%</Typography></Grid>
                  
                  <Grid size={{ xs: 8 }} component="div"><Typography variant="body2">{t().rating.kFactor}</Typography></Grid>
                  <Grid size={{ xs: 4 }} component="div"><Typography variant="body2" align="right">{result.k_factor.toFixed(2)}</Typography></Grid>
                  
                  <Grid size={{ xs: 8 }} component="div"><Typography variant="body2">{t().rating.survivalWeight}</Typography></Grid>
                  <Grid size={{ xs: 4 }} component="div"><Typography variant="body2" align="right">{result.survival_weight.toFixed(2)}x</Typography></Grid>
                  
                  <Grid size={{ xs: 8 }} component="div"><Typography variant="body2">{t().rating.streakWeight}</Typography></Grid>
                  <Grid size={{ xs: 4 }} component="div"><Typography variant="body2" align="right">{result.streak_weight.toFixed(2)}x</Typography></Grid>
                  
                  <Grid size={{ xs: 8 }} component="div"><Typography variant="body2">{t().rating.perfWeight}</Typography></Grid>
                  <Grid size={{ xs: 4 }} component="div"><Typography variant="body2" align="right">{result.perf_weight.toFixed(2)}x</Typography></Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

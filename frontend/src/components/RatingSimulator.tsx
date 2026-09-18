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
        Rating Algorithm Simulator
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Input Parameters</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField 
                    fullWidth label="Player Rating" name="player_rating" 
                    type="number" value={input.player_rating} onChange={handleChange} 
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField 
                    fullWidth label="Opponent Rating" name="opponent_rating" 
                    type="number" value={input.opponent_rating} onChange={handleChange} 
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField 
                    fullWidth label="Wins Count" name="wins_count" 
                    type="number" value={input.wins_count} onChange={handleChange} 
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField 
                    fullWidth label="Streak" name="streak" 
                    type="number" value={input.streak} onChange={handleChange} 
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField 
                    fullWidth label="Survivors" name="survivor_count" 
                    type="number" value={input.survivor_count} onChange={handleChange} 
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField 
                    fullWidth label="Team Size" name="initial_count" 
                    type="number" value={input.initial_count} onChange={handleChange} 
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField 
                    fullWidth label="Performance (0.95-1.05)" name="performance" 
                    type="number" value={input.performance} onChange={handleChange} 
                    inputProps={{ step: 0.01 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel
                    control={<Switch checked={input.is_winner} onChange={handleChange} name="is_winner" />}
                    label="Is Winner?"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button variant="contained" fullWidth onClick={handleSimulate}>
                    Calculate Delta
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          {result && (
            <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main' }}>
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>Simulation Result</Typography>
                <Box sx={{ textAlign: 'center', my: 2 }}>
                  <Typography variant="h2" color={result.delta >= 0 ? 'success.main' : 'error.main'}>
                    {result.delta >= 0 ? `+${result.delta}` : result.delta}
                  </Typography>
                  <Typography color="textSecondary">Elo Delta</Typography>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Grid container spacing={1}>
                  <Grid item xs={8}><Typography variant="body2">Expected Win Rate:</Typography></Grid>
                  <Grid item xs={4}><Typography variant="body2" align="right">{(result.expected_win_rate * 100).toFixed(2)}%</Typography></Grid>
                  
                  <Grid item xs={8}><Typography variant="body2">K-Factor:</Typography></Grid>
                  <Grid item xs={4}><Typography variant="body2" align="right">{result.k_factor.toFixed(2)}</Typography></Grid>
                  
                  <Grid item xs={8}><Typography variant="body2">Survival Weight:</Typography></Grid>
                  <Grid item xs={4}><Typography variant="body2" align="right">{result.survival_weight.toFixed(2)}x</Typography></Grid>
                  
                  <Grid item xs={8}><Typography variant="body2">Streak Weight:</Typography></Grid>
                  <Grid item xs={4}><Typography variant="body2" align="right">{result.streak_weight.toFixed(2)}x</Typography></Grid>
                  
                  <Grid item xs={8}><Typography variant="body2">Perf Weight:</Typography></Grid>
                  <Grid item xs={4}><Typography variant="body2" align="right">{result.perf_weight.toFixed(2)}x</Typography></Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

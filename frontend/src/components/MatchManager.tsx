import { useState } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Card, 
  CardContent, 
  Grid, 
  FormControlLabel, 
  Switch, 
  Alert, 
  Snackbar 
} from '@mui/material';
import { UploadMatchResult } from '../../wailsjs/go/main/App';
import { t } from '../i18n';

export default function MatchManager() {
  const [formData, setFormData] = useState({
    uid: '',
    match_id: '',
    rank: 1,
    score_delta: 20,
    is_winner: false,
    survivor_count: 1
  });

  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = {
        uid: parseInt(formData.uid),
        match_id: formData.match_id,
        rank: formData.rank,
        score_delta: formData.score_delta,
        is_winner: formData.is_winner,
        survivor_count: formData.survivor_count,
        match_time: new Date().toISOString()
      };

      await UploadMatchResult(result as any);
      setNotification({
        open: true,
        message: t().match.uploadSuccess,
        severity: 'success'
      });
      
      // Reset form
      setFormData({
        uid: '',
        match_id: '',
        rank: 1,
        score_delta: 20,
        is_winner: false,
        survivor_count: 1
      });
    } catch (err) {
      setNotification({
        open: true,
        message: `${t().match.uploadFailed}: ${err}`,
        severity: 'error'
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) : value)
    }));
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t().match.title}
      </Typography>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary">
            {t().match.manualUpload}
          </Typography>
          
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label={t().match.uid}
                  name="uid"
                  type="number"
                  value={formData.uid}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label={t().match.matchId}
                  name="match_id"
                  value={formData.match_id}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label={t().match.rank}
                  name="rank"
                  type="number"
                  value={formData.rank}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label={t().match.scoreDelta}
                  name="score_delta"
                  type="number"
                  value={formData.score_delta}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label={t().match.survivorCount}
                  name="survivor_count"
                  type="number"
                  value={formData.survivor_count}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={
                    <Switch
                      name="is_winner"
                      checked={formData.is_winner}
                      onChange={handleChange}
                      color="primary"
                    />
                  }
                  label={t().match.isWinner}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Button 
                  type="submit" 
                  variant="contained" 
                  color="primary"
                  size="large"
                >
                  {t().match.uploadResult}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={notification.severity} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

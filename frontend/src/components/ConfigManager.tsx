import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Card, 
  CardContent, 
  Grid, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  IconButton, 
  Alert, 
  Snackbar,
  Divider
} from '@mui/material';
import { Restore, Save } from '@mui/icons-material';
import { GetConfig, SaveConfig, GetConfigHistory, RestoreConfig } from '../../wailsjs/go/main/App';

export default function ConfigManager() {
  const [config, setConfig] = useState<any>({
    upstream_url: '',
    management_token: '',
    database: { dsn: '' },
    redis: { addr: '', password: '', db: 0 }
  });

  const [history, setHistory] = useState<any[]>([]);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const cfg = await GetConfig();
      setConfig(cfg);
      const hist = await GetConfigHistory();
      setHistory(hist);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    try {
      await SaveConfig(config);
      setNotification({
        open: true,
        message: 'Configuration saved and backed up successfully!',
        severity: 'success'
      });
      loadData();
    } catch (err) {
      setNotification({
        open: true,
        message: `Failed to save configuration: ${err}`,
        severity: 'error'
      });
    }
  };

  const handleRestore = async (filename: string) => {
    try {
      await RestoreConfig(filename);
      setNotification({
        open: true,
        message: 'Configuration restored successfully!',
        severity: 'success'
      });
      loadData();
    } catch (err) {
      setNotification({
        open: true,
        message: `Failed to restore configuration: ${err}`,
        severity: 'error'
      });
    }
  };

  const handleChange = (path: string, value: any) => {
    const newConfig = { ...config };
    const parts = path.split('.');
    let current = newConfig;
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    setConfig(newConfig);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Configuration Management
      </Typography>

      <Grid container spacing={3}>
        {/* Editor */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Edit Current Configuration
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Upstream URL"
                      value={config.upstream_url}
                      onChange={(e) => handleChange('upstream_url', e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Management Token"
                      type="password"
                      value={config.management_token}
                      onChange={(e) => handleChange('management_token', e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 1 }}>Database</Divider>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="DSN"
                      value={config.database.dsn}
                      onChange={(e) => handleChange('database.dsn', e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 1 }}>Redis</Divider>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <TextField
                      fullWidth
                      label="Address"
                      value={config.redis.addr}
                      onChange={(e) => handleChange('redis.addr', e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="DB"
                      type="number"
                      value={config.redis.db}
                      onChange={(e) => handleChange('redis.db', parseInt(e.target.value))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Button 
                      variant="contained" 
                      startIcon={<Save />}
                      onClick={handleSave}
                      sx={{ mt: 2 }}
                    >
                      Save & Backup
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* History */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Version History
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 400, mt: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.version}>
                        <TableCell>
                          {new Date(item.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton 
                            color="secondary" 
                            size="small"
                            onClick={() => handleRestore(item.filename)}
                            title="Restore this version"
                          >
                            <Restore />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {history.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} align="center">No history yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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

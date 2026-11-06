import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Button, 
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Delete, Visibility, Search } from '@mui/icons-material';
import { GetRedisKeys, DeleteRedisKey } from '../../wailsjs/go/main/App';
import { t } from '../i18n';

export default function RedisBrowser() {
  const [keys, setKeys] = useState<any[]>([]);
  const [pattern, setPattern] = useState('*');
  const [selectedKey, setSelectedKey] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const fetchKeys = async () => {
    try {
      const result = await GetRedisKeys(pattern);
      setKeys(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleDelete = async (key: string) => {
    if (window.confirm(`${t().redis.confirmDelete} ${key}?`)) {
      await DeleteRedisKey(key);
      fetchKeys();
    }
  };

  const handleView = (key: any) => {
    setSelectedKey(key);
    setOpen(true);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t().redis.title}
      </Typography>
      
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <TextField 
          label={t().redis.pattern} 
          value={pattern} 
          onChange={(e) => setPattern(e.target.value)}
          size="small"
        />
        <Button variant="contained" onClick={fetchKeys} startIcon={<Search />}>
          {t().redis.search}
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t().redis.key}</TableCell>
              <TableCell>{t().redis.type}</TableCell>
              <TableCell>{t().redis.ttl}</TableCell>
              <TableCell align="right">{t().redis.actions}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {keys.map((k) => (
              <TableRow key={k.key}>
                <TableCell>{k.key}</TableCell>
                <TableCell>{k.type}</TableCell>
                <TableCell>{k.ttl}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleView(k)} color="info">
                    <Visibility />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(k.key)} color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t().redis.key}: {selectedKey?.key}</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" gutterBottom>{t().redis.value}</Typography>
          <Box sx={{ 
            p: 2, 
            bgcolor: 'background.default', 
            borderRadius: 1, 
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {selectedKey?.value || t().redis.emptyUnsupported}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t().redis.close}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

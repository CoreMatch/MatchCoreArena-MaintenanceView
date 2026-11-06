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
  IconButton,
  TextField
} from '@mui/material';
import { Edit, Save, Cancel } from '@mui/icons-material';
import { GetUsers, UpdateUserRankScore } from '../../wailsjs/go/main/App';
import { t } from '../i18n';

export default function DatabaseManager() {
  const [users, setUsers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editScore, setEditScore] = useState<number>(0);

  const fetchUsers = async () => {
    try {
      const result = await GetUsers();
      setUsers(result || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user: any) => {
    setEditingId(user.uid);
    setEditScore(user.rank_score);
  };

  const handleSave = async (uid: number) => {
    try {
      await UpdateUserRankScore(uid, editScore);
      setEditingId(null);
      fetchUsers();
    } catch (err) {
      alert(`${t().database.failedUpdate}: ${err}`);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t().database.title}
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t().database.uid}</TableCell>
              <TableCell>{t().database.level}</TableCell>
              <TableCell>{t().database.exp}</TableCell>
              <TableCell>{t().database.rankScore}</TableCell>
              <TableCell>{t().database.wins}</TableCell>
              <TableCell align="right">{t().database.actions}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.uid}>
                <TableCell>{u.uid}</TableCell>
                <TableCell>{u.level}</TableCell>
                <TableCell>{u.experience}</TableCell>
                <TableCell>
                  {editingId === u.uid ? (
                    <TextField 
                      type="number" 
                      value={editScore} 
                      onChange={(e) => setEditScore(parseInt(e.target.value))}
                      size="small"
                    />
                  ) : (
                    u.rank_score
                  )}
                </TableCell>
                <TableCell>{u.wins_count}</TableCell>
                <TableCell align="right">
                  {editingId === u.uid ? (
                    <>
                      <IconButton onClick={() => handleSave(u.uid)} color="primary">
                        <Save />
                      </IconButton>
                      <IconButton onClick={() => setEditingId(null)}>
                        <Cancel />
                      </IconButton>
                    </>
                  ) : (
                    <IconButton onClick={() => handleEdit(u)} color="primary">
                      <Edit />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

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
      alert('Failed to update: ' + err);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        User Management
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>UID</TableCell>
              <TableCell>Level</TableCell>
              <TableCell>Exp</TableCell>
              <TableCell>Rank Score</TableCell>
              <TableCell>Wins</TableCell>
              <TableCell align="right">Actions</TableCell>
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

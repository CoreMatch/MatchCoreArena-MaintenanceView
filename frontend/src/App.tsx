import { useState, useMemo } from 'react';
import { 
  Box, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  AppBar, 
  Toolbar, 
  Typography, 
  CssBaseline,
  ThemeProvider,
  createTheme
} from '@mui/material';
import { 
  Dashboard as DashboardIcon, 
  Storage, 
  Dns, 
  Calculate,
  History,
  Settings
} from '@mui/icons-material';

import Dashboard from './components/Dashboard';
import RedisBrowser from './components/RedisBrowser';
import DatabaseManager from './components/DatabaseManager';
import RatingSimulator from './components/RatingSimulator';
import MatchManager from './components/MatchManager';

const drawerWidth = 240;

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#e94560',
    },
    background: {
      default: '#0f3460',
      paper: '#16213e',
    },
  },
});

export default function App() {
  const [selectedView, setSelectedView] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'redis', label: 'Redis Browser', icon: <Storage /> },
    { id: 'database', label: 'Database', icon: <Dns /> },
    { id: 'match', label: 'Match Manager', icon: <History /> },
    { id: 'rating', label: 'Rating Simulator', icon: <Calculate /> },
  ];

  const renderContent = () => {
    switch (selectedView) {
      case 'redis':
        return <RedisBrowser />;
      case 'database':
        return <DatabaseManager />;
      case 'match':
        return <MatchManager />;
      case 'rating':
        return <RatingSimulator />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <Typography variant="h6" noWrap component="div">
              MCA Maintenance Panel
            </Typography>
          </Toolbar>
        </AppBar>
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
          }}
        >
          <Toolbar />
          <Box sx={{ overflow: 'auto' }}>
            <List>
              {menuItems.map((item) => (
                <ListItem key={item.id} disablePadding>
                  <ListItemButton 
                    selected={selectedView === item.id}
                    onClick={() => setSelectedView(item.id)}
                  >
                    <ListItemIcon>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        </Drawer>
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <Toolbar />
          {renderContent()}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

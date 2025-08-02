import React from 'react';
import ChatFlow from './components/ChatFlow.jsx';
import Header from './components/Header.jsx';
import { ReactFlowProvider } from 'reactflow';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import 'reactflow/dist/style.css';
import './App.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6a1b9a',
    },
    secondary: {
      main: '#4caf50',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 300,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Header />
        <ReactFlowProvider>
          <ChatFlow />
        </ReactFlowProvider>
      </div>
    </ThemeProvider>
  );
}

export default App;

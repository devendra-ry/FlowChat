import React from 'react';
import ChatFlow from './components/ChatFlow.jsx';  // Updated extension
import { ReactFlowProvider } from 'reactflow';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import 'reactflow/dist/style.css';
import './App.css';

const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#f5f5f5',
      paper: '#ffffff'
    }
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ width: '100vw', height: '100vh' }}>
        <ReactFlowProvider>
          <ChatFlow />
        </ReactFlowProvider>
      </div>
    </ThemeProvider>
  );
}

export default App;

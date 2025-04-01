import React from 'react';
import ChatFlow from './components/ChatFlow';
import { ReactFlowProvider } from 'reactflow';
import './App.css';

function App() {
  return (
    <div className="App">
      <ReactFlowProvider>
        <ChatFlow />
      </ReactFlowProvider>
    </div>
  );
}

export default App;
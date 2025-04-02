import '../styles/ChatFlow.css';
import React, { useState, useCallback } from 'react';
import ReactFlow, { addEdge, Background, Controls, MiniMap } from 'reactflow';
import ChatNode from './ChatNode';
import 'reactflow/dist/style.css';
import { Box, Paper } from '@mui/material';

const nodeTypes = {
  chatNode: ChatNode,
};

const initialNodes = [
  {
    id: '1',
    type: 'chatNode',
    data: { 
      message: 'Hello! How can I help you today?',
      isAI: true,
      responses: ['Ask a new question', 'Continue previous topic'],
      onResponseClick: null // Will be set in the component
    },
    position: { x: 250, y: 0 },
  },
];

function ChatFlow() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const addChatNode = useCallback((response, sourceNodeId, isNewBranch = false) => {
    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    const newNode = {
      id: `node-${nodes.length + 1}`,
      type: 'chatNode',
      data: {
        message: response,
        isAI: false,
        responses: ['Continue this topic', 'Ask a new question'],
        onResponseClick: (r) => handleResponseClick(r, `node-${nodes.length + 1}`)
      },
      position: {
        x: isNewBranch ? sourceNode.position.x + 300 : sourceNode.position.x,
        y: isNewBranch ? sourceNode.position.y : sourceNode.position.y + 200,
      },
    };
    
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, {
      id: `edge-${edges.length + 1}`,
      source: sourceNodeId,
      target: newNode.id,
    }]);
  }, [nodes, edges]);

  const handleResponseClick = useCallback((response, nodeId) => {
    const isNewBranch = response === 'Ask a new question';
    setChatHistory(prev => [...prev, { message: response, sender: 'user' }]);
    addChatNode(response, nodeId, isNewBranch);
  }, [addChatNode]);

  return (
    <Box className="chat-container">
      <Paper 
        elevation={4}
        className="flow-area"
        sx={{
          bgcolor: 'background.default',
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          {/* Removing the Controls component */}
          <MiniMap />
        </ReactFlow>
      </Paper>
      <Paper 
        className="chat-history"
        sx={{
          p: 2,
          maxHeight: '100vh',
          overflowY: 'auto',
          bgcolor: 'background.paper',
          borderRadius: 2
        }}
      >
        {chatHistory.map((chat, index) => (
          <Box
            key={index}
            sx={{
              p: 1,
              mb: 1,
              bgcolor: chat.sender === 'user' ? '#e3f2fd' : '#f5f5f5',
              borderRadius: 2,
              maxWidth: '80%',
              ml: chat.sender === 'user' ? 'auto' : 0
            }}
          >
            {chat.message}
          </Box>
        ))}
      </Paper>
    </Box>
  );
}

export default ChatFlow;
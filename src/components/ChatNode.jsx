import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Paper, TextField, Button, Typography, Box } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ReactMarkdown from 'react-markdown';

function ChatNode({ data, id }) {
  const [inputValue, setInputValue] = useState('');
  
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      // Pass the node's ID when submitting input
      data.onInputSubmit(inputValue, id);
      setInputValue('');
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        bgcolor: data.isAI ? '#f0f7ff' : '#e6f7f2',
        borderRadius: 3,
        minWidth: '250px',
        maxWidth: '450px',
        position: 'relative',
        zIndex: 1,
        transition: 'all 0.2s ease'
      }}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ background: '#555', width: '8px', height: '8px' }} 
      />
      
      {/* Using ReactMarkdown to properly render markdown formatting */}
      {data.isLoading ? (
        <Box
          sx={{
            mb: data.responses ? 2 : 0,
            color: 'text.primary',
            fontSize: '14px',
            lineHeight: 1.6,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <div className="loading-spinner" />
          <Typography component="span" variant="body1">
            {data.message}
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            mb: data.responses ? 2 : 0,
            color: 'text.primary',
            fontSize: '14px',
            lineHeight: 1.6,
            wordBreak: 'break-word'
          }}
        >
          <ReactMarkdown>{data.message}</ReactMarkdown>
        </Box>
      )}
      
      {data.isInput && (
        <Box mt={2}>
          <TextField
            fullWidth
            size="small"
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type your query here..."
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'background.paper',
              }
            }}
          />
        </Box>
      )}
      
      {data.responses && !data.isLoading && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            mt: 2
          }}
        >
          {data.responses.map((response, index) => (
            <Button
              key={index}
              variant="outlined"
              onClick={() => data.onResponseClick(response)}
              endIcon={<SendIcon />}
              sx={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                textTransform: 'none'
              }}
            >
              {response}
            </Button>
          ))}
        </Box>
      )}
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: '#555', width: '8px', height: '8px' }} 
      />
    </Paper>
  );
}

export default ChatNode;
import '../styles/ChatFlow.css';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls,
  useNodesState,
  useEdgesState
} from 'reactflow';
import ChatNode from './ChatNode';
import { generateResponse } from '../services/chatService';
import 'reactflow/dist/style.css';

// Define nodeTypes outside the component to prevent recreation on each render
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
      isInput: true,
      responses: ['Ask a new question'],
      onResponseClick: null,
      onInputSubmit: null,
      history: [] // Add history array
    },
    position: { x: 250, y: 0 },
  },
];

function ChatFlow() {
  // Initialize nodeCounter before using useNodesState
  const nodeCounter = useRef(1); // Start at 1 since we have one initial node
  
  // Create refs for handlers first to break circular dependencies
  const handleResponseClickRef = useRef(null);
  const handleInputSubmitRef = useRef(null);
  const addChatNodeRef = useRef(null);
  
  // Initialize nodes with proper IDs and handlers using refs
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes.map((node, index) => ({
      ...node,
      id: `node-${index + 1}`, // Ensure consistent ID format
      data: {
        ...node.data,
        nodeId: `node-${index + 1}`, // Store the ID in the data as well
        onResponseClick: (r) => handleResponseClickRef.current(r, `node-${index + 1}`),
        onInputSubmit: (message, id) => handleInputSubmitRef.current(message, id)
      }
    }))
  );
  
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Use ref to store nodes to avoid dependency issues
  const nodesRef = useRef(nodes);
  
  // Update ref when nodes change
  useEffect(() => {
    nodesRef.current = nodes;
    
    // Throttle logging to once per second
    const now = Date.now();
    if (now - lastLogTime.current > 1000) {
      console.log("Nodes updated:", nodes.map(n => ({ id: n.id, message: n.data.message.substring(0, 20) })));
      lastLogTime.current = now;
    }
  }, [nodes]);

  const lastLogTime = useRef(0);
  const defaultViewport = useMemo(() => ({ zoom: 0.8, x: 0, y: 0 }), []);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  // Define addChatNode with useCallback and store in ref
  const addChatNode = useCallback((response, sourceNodeId, isAI = false, isLoading = false, isInput = false) => {
    const currentNodes = nodesRef.current;
    console.log("Looking for source node:", sourceNodeId, "in", currentNodes);
    
    // Improved node lookup - try both with and without the 'node-' prefix
    let sourceNode = currentNodes.find(n => n.id === sourceNodeId);
    if (!sourceNode && !sourceNodeId.startsWith('node-')) {
      sourceNode = currentNodes.find(n => n.id === `node-${sourceNodeId}`);
    } else if (!sourceNode && sourceNodeId.startsWith('node-')) {
      sourceNode = currentNodes.find(n => n.id === sourceNodeId.replace('node-', ''));
    }
    
    if (!sourceNode) {
      console.error(`Source node ${sourceNodeId} not found in:`, currentNodes);
      // Fallback to the first node if source not found
      sourceNode = currentNodes[0];
      if (!sourceNode) {
        console.error("No nodes available to connect to");
        return null;
      }
      console.log("Using fallback node:", sourceNode);
    }
    
    // Get source node history
    const sourceHistory = sourceNode?.data?.history || [];
    
    // Generate unique ID using counter ref
    const newNodeId = `node-${++nodeCounter.current}`;
    console.log("Creating new node with ID:", newNodeId);
    
    // Update position calculation
    const baseX = sourceNode.position.x;
    const baseY = sourceNode.position.y;
    const position = {
      x: baseX + (currentNodes.filter(n => n.position.x === baseX).length * 100),
      y: baseY + 150
    };
    
    // Create the new node
    const newNode = {
      id: newNodeId,
      type: 'chatNode',
      data: { 
        message: response,
        isAI: isAI,
        isLoading: isLoading,
        isInput: isInput,
        nodeId: newNodeId,
        responses: isAI && !isLoading ? ['Continue this topic', 'Start a new branch for a new question'] : null,
        onResponseClick: (r) => handleResponseClickRef.current(r, newNodeId),
        onInputSubmit: isInput ? handleInputSubmitRef.current : null,
        history: sourceHistory // Copy history from source node
      },
      position: {
        x: sourceNode.position.x + 300,
        y: isAI ? sourceNode.position.y : sourceNode.position.y + 100,
      },
    };
    
    // Update nodes and edges
    setNodes(nds => [...nds, newNode]);
    setEdges(eds => [...eds, {
      id: `edge-${eds.length + 1}`,
      source: sourceNodeId,
      target: newNodeId,
    }]);
  
    return newNodeId;
  }, [setNodes, setEdges]); // Only depend on setters, not state values
  
  // Store addChatNode in ref to avoid dependency issues
  useEffect(() => {
    addChatNodeRef.current = addChatNode;
  }, [addChatNode]);

  // Handle input submission
  const handleInputSubmit = useCallback((message, sourceNodeId) => {
    if (!message.trim()) return;
    
    // Find the source node and its history
    const sourceNode = nodesRef.current.find(node => node.id === sourceNodeId);
    const nodeHistory = sourceNode?.data?.history || [];
    
    setChatHistory(prev => [...prev, { message, sender: 'user' }]);
    
    // Add user message node
    const userNodeId = addChatNodeRef.current(message, sourceNodeId, false, false, false);
    
    if (userNodeId) {
      // Add loading AI node
      setIsLoading(true);
      const aiNodeId = addChatNodeRef.current("Thinking...", userNodeId, true, true, false);
      
      if (aiNodeId) {
        // Get AI response with history
        generateResponse(message, [...nodeHistory, { message, sender: 'user' }])
          .then(aiResponse => {
            setNodes(currentNodes => 
              currentNodes.map(node => 
                node.id === aiNodeId 
                  ? { 
                      ...node, 
                      data: { 
                        ...node.data, 
                        message: aiResponse, 
                        isLoading: false,
                        responses: ['Continue this topic', 'Start a new branch for a new question'],
                        history: [...nodeHistory, 
                          { message, sender: 'user' },
                          { message: aiResponse, sender: 'ai' }
                        ]
                      } 
                    } 
                  : node
              )
            );
            setChatHistory(prev => [...prev, { message: aiResponse, sender: 'ai' }]);
            setIsLoading(false);
          })
          .catch(error => {
            console.error('Error getting AI response:', error);
            setIsLoading(false);
          });
      }
    }
  }, [setNodes, setChatHistory, setIsLoading]); // Only depend on setters, not state values

  // Store handleInputSubmit in ref
  useEffect(() => {
    handleInputSubmitRef.current = handleInputSubmit;
  }, [handleInputSubmit]);

  // Handle response click
  const handleResponseClick = useCallback((response, nodeId) => {
    const isNewBranch = response === 'Start a new branch for a new question';
    setChatHistory(prev => [...prev, { message: response, sender: 'user' }]);
    
    if (isNewBranch) {
      // For a new branch, create a new input node
      const newInputNodeId = addChatNodeRef.current("What would you like to ask?", nodeId, false, false, true);
      
      // Update the new node to have an input field
      if (newInputNodeId) {
        setNodes(currentNodes => 
          currentNodes.map(node => 
            node.id === newInputNodeId 
              ? { 
                  ...node, 
                  data: { 
                    ...node.data, 
                    isInput: true,
                    onInputSubmit: handleInputSubmitRef.current
                  } 
                } 
              : node
          )
        );
      }
    } else {
      // Continue from this branch - create an input node for continuing the topic
      const newInputNodeId = addChatNodeRef.current("Continue the conversation...", nodeId, false, false, true);
      
      // Update the new node to have an input field
      if (newInputNodeId) {
        setNodes(currentNodes => 
          currentNodes.map(node => 
            node.id === newInputNodeId 
              ? { 
                  ...node, 
                  data: { 
                    ...node.data, 
                    isInput: true,
                    onInputSubmit: handleInputSubmitRef.current
                  } 
                } 
              : node
          )
        );
      }
    }
  }, [setNodes, setChatHistory]); // Only depend on setters, not state values

  // Store handleResponseClick in ref
  useEffect(() => {
    handleResponseClickRef.current = handleResponseClick;
  }, [handleResponseClick]);

  // Set initial node's input handler only once on mount
  useEffect(() => {
    const initialNode = nodes.find(node => node.id === 'node-1');
    if (initialNode && handleInputSubmitRef.current) {
      setNodes(currentNodes => 
        currentNodes.map(node => 
          node.id === 'node-1' 
            ? { 
                ...node, 
                data: { 
                  ...node.data, 
                  onInputSubmit: handleInputSubmitRef.current 
                } 
              } 
            : node
        )
      );
    }
  }, []); // Empty dependency array - only run once on mount

  // Return statement remains the same
  return (
    <div className="chat-container">
      <div className="flow-area">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          defaultViewport={defaultViewport}
          attributionPosition="bottom-right"
        >
          <Background color="#f8f8f8" gap={16} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default ChatFlow;
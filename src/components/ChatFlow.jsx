import '../styles/ChatFlow.css';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType // Import MarkerType for edge arrows
} from 'reactflow';
import ChatNode from './ChatNode';
import { generateResponse } from '../services/chatService'; // Assuming you have this service
import 'reactflow/dist/style.css';

// Define nodeTypes outside the component
const nodeTypes = {
  chatNode: ChatNode,
};

// Consistent ID for the initial node
const INITIAL_NODE_ID = 'node-1';

const initialNodes = [
  {
    id: INITIAL_NODE_ID,
    type: 'chatNode',
    data: {
      message: 'Hello! How can I help you today?',
      isAI: true,
      isInput: true, // Initial node acts as input first
      responses: null, // No predefined responses initially
      onResponseClick: null, // Will be set later via ref
      onInputSubmit: null, // Will be set later via ref
      history: [], // Initial history is empty
      nodeId: INITIAL_NODE_ID // Store ID in data
    },
    position: { x: 0, y: 0 }, // Center the initial node horizontally
  },
];

function ChatFlow() {
  const nodeCounter = useRef(1); // Start at 1 for the initial node
  const [nodes, setNodes, onNodesChange] = useNodesState([]); // Initialize empty, set in useEffect
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(false); // Tracks if *any* API call is loading

  // Refs for handlers to avoid stale closures and dependency loops
  const handleInputSubmitRef = useRef(null);
  const handleResponseClickRef = useRef(null);
  const addChatNodeRef = useRef(null);

  // Use ref to store current nodes state for access in callbacks without causing re-renders
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Use ref to store current edges state for positioning logic
  const edgesRef = useRef(edges);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const defaultViewport = useMemo(() => ({ zoom: 0.8, x: 0, y: 0 }), []);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  // --- Core Logic: Adding Nodes ---
  // useCallback ensures this function reference is stable unless dependencies change
  const addChatNode = useCallback((message, sourceNodeId, isAI = false, isLoadingNode = false, isInput = false) => {
    const currentNodes = nodesRef.current; // Use ref for up-to-date nodes list
    const currentEdges = edgesRef.current; // Use ref for up-to-date edges list

    // Debug log to help diagnose issues
    console.log("Adding node with source:", sourceNodeId, "Current nodes:", currentNodes.map(n => n.id));

    const sourceNode = currentNodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) {
      console.error(`Source node ${sourceNodeId} not found! Cannot add new node.`);
      console.log("Available nodes:", currentNodes);
      return null; // Indicate failure: return null instead of just ID
    }

    const newNodeId = `node-${++nodeCounter.current}`;
    let newPosition;
    const horizontalSpacing = 350; // Space between initial branches
    const verticalSpacing = 150;   // Space between user/AI nodes in a branch

    // --- Positioning Logic ---
    // CASE 1: User question directly from the *initial* AI node
    if (!isAI && !isInput && !isLoadingNode && sourceNodeId === INITIAL_NODE_ID) {
      const initialNode = sourceNode; // Source is the initial node
      // Find direct user question children of the initial node by checking edges
      const directUserChildren = currentNodes.filter(n =>
        !n.data.isAI && !n.data.isInput && !n.data.isLoading &&
        currentEdges.some(e => e.source === INITIAL_NODE_ID && e.target === n.id)
      );

      const childrenCount = directUserChildren.length;
      const direction = childrenCount % 2 === 0 ? -1 : 1; // Alternate left (-1) / right (1)
      // Calculate horizontal offset based on how many direct children exist
      const horizontalOffset = Math.ceil((childrenCount + 1) / 2) * horizontalSpacing * direction;

      newPosition = {
        x: initialNode.position.x + horizontalOffset,
        y: initialNode.position.y + verticalSpacing, // Place below initial node
      };
    }
    // CASE 2: AI response (Loading or Final) or Input node below a User question/AI response, or subsequent user question
    else {
      // Position directly below the source node
      newPosition = {
        x: sourceNode.position.x,
        y: sourceNode.position.y + verticalSpacing,
      };
    }

    // --- Node Data ---
    const sourceHistory = sourceNode.data.history || [];
    let newNodeHistory = sourceHistory;
    // Add current message to history only if it's a final user message or a final AI response
    // History for final AI response is handled later in handleInputSubmit after API call
    if (!isAI && !isInput && !isLoadingNode) { // This is a user message node
        newNodeHistory = [...sourceHistory, { message, sender: 'user' }];
    }
    // Loading nodes and input nodes inherit history but don't add their own message to it yet

    const newNode = {
      id: newNodeId,
      type: 'chatNode',
      position: newPosition,
      data: {
        message: message,
        isAI: isAI,
        isLoading: isLoadingNode,
        isInput: isInput,
        nodeId: newNodeId,
        // Add response options only to final AI nodes (not loading, not input)
        responses: isAI && !isLoadingNode && !isInput ? ['Continue this topic', 'Ask a new question from here'] : null,
        // Assign handlers using refs to ensure they are always up-to-date
        // Assign response click handler only if there are responses
        onResponseClick: (isAI && !isLoadingNode && !isInput)
                          ? (response) => handleResponseClickRef.current(response, newNodeId)
                          : null,
        // Assign submit handler for input nodes OR the initial AI node (which starts as input)
        onInputSubmit: (isInput || (isAI && sourceNodeId === INITIAL_NODE_ID))
                       ? (msg, id) => handleInputSubmitRef.current(msg, id)
                       : null,
        history: newNodeHistory // History up to this point
      },
    };

    // --- Update State (Scheduled by React) ---
    setNodes(nds => [...nds, newNode]);
    setEdges(eds => [...eds, {
      id: `edge-${sourceNodeId}-${newNodeId}`, // More descriptive edge ID
      source: sourceNodeId,
      target: newNodeId,
      type: 'smoothstep', // Or 'default', 'straight', 'step'
      markerEnd: { type: MarkerType.ArrowClosed }, // Add arrow head
    }]);

    // --- IMPORTANT FIX: Return the full newNode object ---
    // This gives the caller immediate access without waiting for state update
    return newNode;

  }, [setNodes, setEdges]); // Dependencies are only the state setters

  // Store the latest addChatNode function in the ref
  useEffect(() => {
    addChatNodeRef.current = addChatNode;
  }, [addChatNode]);


  // --- Handle User Input Submission ---
  const handleInputSubmit = useCallback((message, sourceNodeId) => {
    if (!message.trim()) return;
    
    console.log("Input submitted from node:", sourceNodeId, "Message:", message);
    setIsLoading(true);

    // First, directly create the user node without using promises
    const userNode = addChatNodeRef.current(message, sourceNodeId, false, false, false);
    
    if (!userNode) {
      console.error("Failed to create user node");
      setIsLoading(false);
      return;
    }
    
    // Wait for React to process the state update
    setTimeout(() => {
      // Now create the loading node
      const loadingNode = addChatNodeRef.current("Thinking...", userNode.id, true, true, false);
      
      if (!loadingNode) {
        console.error("Failed to create loading node");
        setIsLoading(false);
        return;
      }
      
      // Call API with the user's message and history
      generateResponse(message, userNode.data.history)
        .then(aiResponse => {
          setNodes(currentNodes => {
            const loadingNodeIndex = currentNodes.findIndex(node => node.id === loadingNode.id);
            if (loadingNodeIndex === -1) {
              console.error("Loading node disappeared before update:", loadingNode.id);
              return currentNodes;
            }

            const existingLoadingNode = currentNodes[loadingNodeIndex];
            const updatedNode = {
              ...existingLoadingNode,
              data: {
                ...existingLoadingNode.data,
                message: aiResponse,
                isLoading: false,
                isAI: true,
                isInput: false,
                responses: ['Continue this topic', 'Ask a new question from here'],
                onResponseClick: (response) => handleResponseClickRef.current(response, loadingNode.id),
                onInputSubmit: null,
                history: [...userNode.data.history, { message: aiResponse, sender: 'ai' }]
              }
            };

            return [
              ...currentNodes.slice(0, loadingNodeIndex),
              updatedNode,
              ...currentNodes.slice(loadingNodeIndex + 1)
            ];
          });
        })
        .catch(error => {
          console.error('Error getting AI response:', error);
          setNodes(currentNodes => currentNodes.map(node =>
            node.id === loadingNode.id
            ? { ...node, data: { ...node.data, message: "Error fetching response.", isLoading: false, isAI: true, responses: null, onInputSubmit: null } }
            : node
          ));
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 0); // Use setTimeout with 0ms to ensure state updates have been processed

  }, [setNodes]);

  // Store the latest handleInputSubmit function in the ref
  useEffect(() => {
    handleInputSubmitRef.current = handleInputSubmit;
  }, [handleInputSubmit]);


  // --- Handle Predefined Response Clicks ---
  const handleResponseClick = useCallback((response, sourceNodeId) => {
    // 'response' is the text clicked (e.g., "Continue this topic")
    // 'sourceNodeId' is the ID of the AI node where the click happened

    // Determine the prompt for the new input node
    const inputPrompt = response === 'Continue this topic'
                      ? "What next?"
                      : "Ask your new question:";

    // Add an input node below the clicked AI node (sourceNodeId)
    // addChatNodeRef handles setting isInput=true and the onInputSubmit handler
    const newNodeObject = addChatNodeRef.current(inputPrompt, sourceNodeId, false, false, true);

    if (!newNodeObject) {
        console.error("Failed to create input node on response click.");
        // Handle error appropriately, maybe show a message to the user
    }
    // No further state update needed here, addChatNode took care of it

  }, [/* No state dependencies needed due to refs */]);

  // Store the latest handleResponseClick function in the ref
  useEffect(() => {
    handleResponseClickRef.current = handleResponseClick;
  }, [handleResponseClick]);


  // --- Initialize Nodes and Assign Handlers ---
  useEffect(() => {
    // Make sure refs are set before initializing nodes
    handleInputSubmitRef.current = handleInputSubmit;
    handleResponseClickRef.current = handleResponseClick;
    addChatNodeRef.current = addChatNode;
    
    // Set initial nodes only once on mount
    // Assign the handlers from refs to the initial node's data
    const initialNodesWithHandlers = initialNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        // Use the refs directly now that we've ensured they're set
        onInputSubmit: (msg, id) => handleInputSubmitRef.current(msg, id),
        onResponseClick: (resp, id) => handleResponseClickRef.current(resp, id)
      }
    }));
    setNodes(initialNodesWithHandlers);
    nodeCounter.current = initialNodes.length; // Sync counter with initial nodes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount


  // --- Render Component ---
  return (
    // Ensure container has dimensions for React Flow to render into
    <div className="chat-container" style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
       {/* Optional: Add a header or other UI elements here */}
       {/* {isLoading && <div style={{ padding: '10px', background: 'rgba(255, 255, 0, 0.5)'}}>Loading...</div>} */}
      <div className="flow-area" style={{ flexGrow: 1, height: '100%', width: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange} // Handles node drag, selection, removal
          onEdgesChange={onEdgesChange} // Handles edge interaction
          onConnect={onConnect}         // Handles manual connection (if enabled)
          nodeTypes={nodeTypes}         // Registers custom node types
          fitView                       // Zooms/pans to fit all nodes on initial render/change
          fitViewOptions={{ padding: 0.15 }} // Add some padding around the fitted view
          minZoom={0.1}                 // Allow zooming out more
          maxZoom={2}
          defaultViewport={defaultViewport} // Initial view settings (overridden by fitView initially)
          attributionPosition="bottom-right"
          nodesDraggable={true}         // Allow users to drag nodes
          nodesConnectable={false}      // Disable manual connection via handles
          elementsSelectable={true}     // Allow selecting nodes/edges
        >
          <Background color="#eee" gap={20} variant="dots" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default ChatFlow;
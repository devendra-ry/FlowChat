import { useState, useCallback, useRef, useEffect } from 'react';
import { addEdge, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import { generateResponse } from '../services/chatService';
import { createNode } from '../utils/nodeUtils';

const INITIAL_NODE_ID = 'node-1';
const H_SPACING = 350;   // horizontal gap between siblings
const V_SPACING = 160;   // vertical gap between parent and child

const initialNodes = [
  createNode(INITIAL_NODE_ID, 'Hello! How can I help you today?', { x: 0, y: 0 }, true, false, true)
];

export function useChatFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(false);
  const nodeCounter = useRef(1);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  // Compute position for a new child based on counted existing children
  const computeChildPosition = useCallback((parentId) => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    const parent = currentNodes.find(n => n.id === parentId);
    if (!parent) return { x: 0, y: 0 };

    // Count existing direct children of this parent
    const children = currentEdges
      .filter(e => e.source === parentId)
      .map(e => currentNodes.find(n => n.id === e.target))
      .filter(Boolean);

    const index = children.length; // 0-based index for the next child
    // Alternate left/right spread: -1, +1, -2, +2, ...
    const direction = index % 2 === 0 ? -1 : 1;
    const span = Math.ceil((index + 1) / 2) * H_SPACING;

    // Base desired position
    let pos = { x: parent.position.x + (span * direction), y: parent.position.y + V_SPACING };

    // Basic collision avoidance: if another node is too close to target pos, nudge horizontally
    const tooClose = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 140;
    let safety = 0;
    while (currentNodes.some(n => tooClose(n.position, pos)) && safety < 10) {
      pos.x += 40 * direction;
      safety++;
    }
    return pos;
  }, []);

  const addChatNode = useCallback((message, sourceNodeId, isAI = false, isLoadingNode = false, isInput = false) => {
    const currentNodes = nodesRef.current;
    const sourceNode = currentNodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) {
      console.error(`Source node ${sourceNodeId} not found!`);
      return null;
    }

    const position = computeChildPosition(sourceNodeId);

    const newNode = createNode(
      `node-${++nodeCounter.current}`,
      message,
      position,
      isAI,
      isLoadingNode,
      isInput,
      sourceNode.data.history,
      handleResponseClick,
      handleInputSubmit
    );

    setNodes(nds => [...nds, newNode]);
    setEdges(eds => [...eds, {
      id: `edge-${sourceNodeId}-${newNode.id}`,
      source: sourceNodeId,
      target: newNode.id,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    }]);

    return newNode;
  }, [setNodes, setEdges, computeChildPosition]);

  const handleInputSubmit = useCallback((message, sourceNodeId) => {
    if (!message.trim()) return;
    setIsLoading(true);

    const userNode = addChatNode(message, sourceNodeId, false, false, false);
    if (!userNode) { setIsLoading(false); return; }

    setTimeout(() => {
      const loadingNode = addChatNode("Thinking...", userNode.id, true, true, false);
      if (!loadingNode) { setIsLoading(false); return; }

      generateResponse(message, userNode.data.history)
        .then(aiResponse => {
          setNodes(currentNodes => {
            const i = currentNodes.findIndex(node => node.id === loadingNode.id);
            if (i === -1) return currentNodes;

            const updatedNode = {
              ...currentNodes[i],
              data: {
                ...currentNodes[i].data,
                message: aiResponse,
                isLoading: false,
                responses: ['Continue this topic', 'Ask a new question from here'],
                history: [...userNode.data.history, { message: aiResponse, sender: 'ai' }]
              }
            };
            return [...currentNodes.slice(0, i), updatedNode, ...currentNodes.slice(i + 1)];
          });
        })
        .catch(error => {
          console.error('Error getting AI response:', error);
          setNodes(currentNodes => currentNodes.map(node =>
            node.id === loadingNode.id
              ? { ...node, data: { ...node.data, message: "Error fetching response.", isLoading: false } }
              : node
          ));
        })
        .finally(() => setIsLoading(false));
    }, 0);
  }, [addChatNode, setNodes]);

  const handleResponseClick = useCallback((response, sourceNodeId) => {
    const inputPrompt = response === 'Continue this topic' ? "What next?" : "Ask your new question:";
    addChatNode(inputPrompt, sourceNodeId, false, false, true);
  }, [addChatNode]);

  useEffect(() => {
    const initialNodesWithHandlers = initialNodes.map(node => ({
      ...node,
      data: { ...node.data, onInputSubmit: handleInputSubmit, onResponseClick: handleResponseClick }
    }));
    setNodes(initialNodesWithHandlers);
    nodeCounter.current = initialNodes.length;
  }, [handleInputSubmit, handleResponseClick, setNodes]);

  return { nodes, edges, onNodesChange, onEdgesChange, onConnect, isLoading };
}
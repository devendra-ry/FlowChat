import { useState, useCallback, useRef, useEffect } from 'react';
import { addEdge, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import { generateResponse } from '../services/chatService';
import { createNode } from '../utils/nodeUtils';

const INITIAL_NODE_ID = 'node-1';

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

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  const addChatNode = useCallback((message, sourceNodeId, isAI = false, isLoadingNode = false, isInput = false) => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const sourceNode = currentNodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) {
      console.error(`Source node ${sourceNodeId} not found!`);
      return null;
    }

    const newNode = createNode(
      `node-${++nodeCounter.current}`,
      message,
      sourceNode.position,
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
  }, [setNodes, setEdges]);

  const handleInputSubmit = useCallback((message, sourceNodeId) => {
    if (!message.trim()) return;
    setIsLoading(true);

    const userNode = addChatNode(message, sourceNodeId);
    if (!userNode) {
      setIsLoading(false);
      return;
    }

    setTimeout(() => {
      const loadingNode = addChatNode("Thinking...", userNode.id, true, true);
      if (!loadingNode) {
        setIsLoading(false);
        return;
      }

      generateResponse(message, userNode.data.history)
        .then(aiResponse => {
          setNodes(currentNodes => {
            const loadingNodeIndex = currentNodes.findIndex(node => node.id === loadingNode.id);
            if (loadingNodeIndex === -1) return currentNodes;

            const updatedNode = {
              ...currentNodes[loadingNodeIndex],
              data: {
                ...currentNodes[loadingNodeIndex].data,
                message: aiResponse,
                isLoading: false,
                responses: ['Continue this topic', 'Ask a new question from here'],
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
            ? { ...node, data: { ...node.data, message: "Error fetching response.", isLoading: false } }
            : node
          ));
        })
        .finally(() => setIsLoading(false));
    }, 0);
  }, [addChatNode, setNodes]);

  const handleResponseClick = useCallback((response, sourceNodeId) => {
    const inputPrompt = response === 'Continue this topic'
                      ? "What next?"
                      : "Ask your new question:";
    addChatNode(inputPrompt, sourceNodeId, false, false, true);
  }, [addChatNode]);

  useEffect(() => {
    const initialNodesWithHandlers = initialNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onInputSubmit: handleInputSubmit,
        onResponseClick: handleResponseClick,
      }
    }));
    setNodes(initialNodesWithHandlers);
    nodeCounter.current = initialNodes.length;
  }, [handleInputSubmit, handleResponseClick, setNodes]);

  return { nodes, edges, onNodesChange, onEdgesChange, onConnect, isLoading };
}
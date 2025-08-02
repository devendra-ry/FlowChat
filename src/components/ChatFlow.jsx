import '../styles/ChatFlow.css';
import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import ChatNode from './ChatNode';
import { useChatFlow } from '../hooks/useChatFlow';
import 'reactflow/dist/style.css';

const nodeTypes = {
  chatNode: ChatNode,
};

function ChatFlow() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, isLoading } = useChatFlow();
  const defaultViewport = useMemo(() => ({ zoom: 0.8, x: 0, y: 0 }), []);

  return (
    <div className="chat-container" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {isLoading && <div className="loading-indicator">Thinking...</div>}
      <div className="flow-area" style={{ flexGrow: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={defaultViewport}
          attributionPosition="bottom-right"
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Background color="#444" gap={20} variant="dots" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default ChatFlow;
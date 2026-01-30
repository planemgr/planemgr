import { useCallback, useMemo, useState, useRef, DragEvent } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  NodeTypes,
  Node,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import styles from './Canvas.module.scss';
import ZoomIndicator from './ZoomIndicator';
import PlatformNode from '../nodes/PlatformNode';
import ComputeNode from '../nodes/ComputeNode';
import ServiceNode from '../nodes/ServiceNode';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

const CanvasInner = () => {
  const { setViewport, screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const nodeIdCounter = useRef(0);

  const nodeTypes: NodeTypes = useMemo(() => ({
    platform: PlatformNode,
    compute: ComputeNode,
    service: ServiceNode,
  }), []);

  const handleInit = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, [setViewport]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${type}-${nodeIdCounter.current++}`,
        type,
        position,
        data: { type, label: `${type.charAt(0).toUpperCase() + type.slice(1)} ${nodeIdCounter.current}` },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes]
  );

  return (
    <div className={styles.canvasContainer}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        onInit={handleInit}
        onDrop={onDrop}
        onDragOver={onDragOver}
        fitView={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className={styles.background}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      <ZoomIndicator />
    </div>
  );
};

const Canvas = () => {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
};

export default Canvas;

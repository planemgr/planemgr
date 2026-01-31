import * as z from "zod";
import { useCallback, useRef, DragEvent, memo } from "react";
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
} from "reactflow";
import { NodeDefinitionSchema } from "@planemgr/plugin-core";

import "reactflow/dist/style.css";
import styles from "./Canvas.module.scss";

import ZoomIndicator from "./ZoomIndicator";
import { type Props as NodeComponentProps } from "./Node";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

export type CanvasProps = {
  nodeTypes: NodeTypes;
};

const CanvasInner = memo(
  ({ nodeTypes }: CanvasProps) => {
    const { setViewport, screenToFlowPosition } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const nodeIdCounter = useRef(0);

    const handleInit = useCallback(() => {
      setViewport({ x: 0, y: 0, zoom: 1 });
    }, [setViewport]);

    const onConnect = useCallback(
      (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
      [setEdges],
    );

    const onDragOver = useCallback((event: DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
      (event: DragEvent) => {
        event.preventDefault();

        let data = null;
        try {
          data = JSON.parse(event.dataTransfer.getData("application/reactflow"));
        } catch {}
        const result = NodeDefinitionSchema.safeParse(data, { reportInput: true });
        if (!result.success) return;
        const nodeDefinition = result.data;

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newNode: Node<NodeComponentProps> = {
          id: `${nodeDefinition.type}-${nodeIdCounter.current++}`,
          type: nodeDefinition.type,
          position,
          data: {
            label:
              `${nodeDefinition.type.charAt(0).toUpperCase() + nodeDefinition.type.slice(1)} ` +
              `${nodeIdCounter.current}`,
            definition: nodeDefinition,
            badge: "BADGE",
            description: "A long winded description goes here.",
          },
        };

        setNodes((_) => _.concat(newNode));
      },
      [screenToFlowPosition, setNodes],
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
  },
  () => true,
); // Never re-render

const Canvas = memo(
  ({ nodeTypes }: CanvasProps) => {
    return (
      <ReactFlowProvider>
        <CanvasInner nodeTypes={nodeTypes} />
      </ReactFlowProvider>
    );
  },
  () => true, // Never re-render
);

export default Canvas;

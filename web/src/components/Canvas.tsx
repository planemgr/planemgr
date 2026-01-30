import { useCallback } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import styles from './Canvas.module.scss';
import ZoomIndicator from './ZoomIndicator';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

const CanvasInner = () => {
  const { setViewport } = useReactFlow();

  const handleInit = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, [setViewport]);

  return (
    <div className={styles.canvasContainer}>
      <ReactFlow
        nodes={[]}
        edges={[]}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        onInit={handleInit}
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

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeType } from '@planemgr/plugin-core';
import styles from './PlatformNode.module.scss';

export interface PlatformNodeData {
  type: NodeType.PLATFORM;
  label: string;
}

const PlatformNode = memo(({ data }: NodeProps<PlatformNodeData>) => {
  return (
    <div className={styles.node}>
      <div className={styles.header}>
        <div className={styles.label}>{data.label}</div>
        <div className={styles.badge}>Platform</div>
      </div>
      <div className={styles.subtitle}>Infrastructure foundation</div>
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
});

PlatformNode.displayName = 'PlatformNode';

export default PlatformNode;

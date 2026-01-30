import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeType } from '@planemgr/plugin-core';
import styles from './ComputeNode.module.scss';

export interface ComputeNodeData {
  type: NodeType.COMPUTE;
  label: string;
}

const ComputeNode = memo(({ data }: NodeProps<ComputeNodeData>) => {
  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div className={styles.header}>
        <div className={styles.label}>{data.label}</div>
        <div className={styles.badge}>Compute</div>
      </div>
      <div className={styles.subtitle}>Computational resource</div>
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
});

ComputeNode.displayName = 'ComputeNode';

export default ComputeNode;

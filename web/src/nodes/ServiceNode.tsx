import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeType } from '@planemgr/plugin-core';
import styles from './ServiceNode.module.scss';

export interface ServiceNodeData {
  type: NodeType.SERVICE;
  label: string;
}

const ServiceNode = memo(({ data }: NodeProps<ServiceNodeData>) => {
  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div className={styles.header}>
        <div className={styles.label}>{data.label}</div>
        <div className={styles.badge}>Service</div>
      </div>
      <div className={styles.subtitle}>Auxiliary service</div>
    </div>
  );
});

ServiceNode.displayName = 'ServiceNode';

export default ServiceNode;

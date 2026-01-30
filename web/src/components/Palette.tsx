import { NodeType } from '@planemgr/plugin-core';
import styles from './Palette.module.scss';

interface NodeTemplate {
  type: NodeType;
  label: string;
  description: string;
}

const nodeTemplates: NodeTemplate[] = [
  {
    type: NodeType.PLATFORM,
    label: 'Platform',
    description: 'Infrastructure foundation',
  },
  {
    type: NodeType.COMPUTE,
    label: 'Compute',
    description: 'Computational resource',
  },
  {
    type: NodeType.SERVICE,
    label: 'Service',
    description: 'Auxiliary service',
  },
];

const Palette = () => {
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className={styles.palette}>
      <div className={styles.header}>Node Types</div>
      <div className={styles.nodes}>
        {nodeTemplates.map((template) => (
          <div
            key={template.type}
            className={`${styles.node} ${styles[template.type]}`}
            draggable
            onDragStart={(e) => onDragStart(e, template.type)}
          >
            <div className={styles.nodeLabel}>{template.label}</div>
            <div className={styles.nodeDescription}>{template.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Palette;

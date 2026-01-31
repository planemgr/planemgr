import { NodeDefinition, NodeType } from "@planemgr/plugin-core";
import styles from "./Palette.module.scss";

interface NodeTemplate {
  type: NodeType;
  label: string;
  description: string;
}

const nodes: NodeTemplate[] = [
  {
    type: NodeType.PLATFORM,
    label: "Platform",
    description: "Infrastructure foundation",
  },
  {
    type: NodeType.COMPUTE,
    label: "Compute",
    description: "Computational resource",
  },
  {
    type: NodeType.SERVICE,
    label: "Service",
    description: "Auxiliary service",
  },
];

const Palette = () => {
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    const definition: NodeDefinition = {
      type: nodeType,
      label: nodes.find((n) => n.type === nodeType)?.label || "",
      id: nodeType + "-" + new Date().getTime(),
    };
    event.dataTransfer.setData("application/reactflow", JSON.stringify(definition));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className={styles.palette}>
      <div className={styles.header}>Node Types</div>
      <div className={styles.nodes}>
        {nodes.map((definition) => (
          <div
            key={definition.type}
            className={`${styles.node} ${styles[definition.type]}`}
            draggable
            onDragStart={(e) => onDragStart(e, definition.type)}
          >
            <div className={styles.nodeLabel}>{definition.label}</div>
            <div className={styles.nodeDescription}>{definition.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Palette;

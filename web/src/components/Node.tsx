import { Handle, Position, NodeProps } from "reactflow";
import { NodeDefinition } from "@planemgr/plugin-core";

import styles from "./Node.module.scss";

export type Props = {
  definition: NodeDefinition;
  badge: string;
  label: string;
  description: string;
};

const Node = ({ data: { definition, badge, description, label } }: NodeProps<Props>) => {
  return (
    <div className={styles.node}>
      {definition.handles?.inputs?.map((input) => (
        <Handle key={input.id} type="target" position={Position.Left} className={styles.handle} />
      ))}

      <div className={styles.header}>
        <div className={styles.label}>{label}</div>
        <div className={styles.badge}>{badge}</div>
      </div>
      <div className={styles.subtitle}>{description}</div>

      {definition.handles?.outputs?.map((output) => (
        <Handle key={output.id} type="source" position={Position.Right} className={styles.handle} />
      ))}
    </div>
  );
};

export default Node;

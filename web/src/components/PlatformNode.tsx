import { NodeResizer, type NodeProps } from "reactflow";
import type { PlanNodeData } from "../graph";

export const PlatformNode = ({ data, selected }: NodeProps<PlanNodeData>) => {
  return (
    <div className="platform-node" style={{ borderColor: data.layerColor }}>
      <NodeResizer color={data.layerColor} isVisible={selected} minWidth={260} minHeight={180} />
      <div className="platform-node__header">
        <div className="platform-node__title">{data.label}</div>
        <div className="platform-node__kind">Platform</div>
      </div>
      <div className="platform-node__subtitle">PaaS or bare metal foundation</div>
    </div>
  );
};

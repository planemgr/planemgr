import { Handle, Position, type NodeProps } from "reactflow";
import type { PlanNodeData } from "../graph";

const driftLabel = (status: PlanNodeData["driftStatus"]) => {
  if (status === "drifted") {
    return "Drift";
  }
  if (status === "in_sync") {
    return "In Sync";
  }
  return "Unknown";
};

export const PlanNode = ({ data }: NodeProps<PlanNodeData>) => (
  <div className="plan-node" style={{ borderColor: data.layerColor }}>
    <div className="plan-node__meta">
      <span className="plan-node__kind">{data.kind}</span>
      <span className={`plan-node__drift plan-node__drift--${data.driftStatus}`}>
        {driftLabel(data.driftStatus)}
      </span>
    </div>
    <div className="plan-node__label">{data.label}</div>
    <Handle className="nodrag nopan" type="target" position={Position.Left} />
    <Handle className="nodrag nopan" type="source" position={Position.Right} />
  </div>
);

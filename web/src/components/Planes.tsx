import { NodeTypes } from "reactflow";
import { NodeType } from "@planemgr/plugin-core";

import Node from "./Node";
import Canvas from "./Canvas";
import styles from "./Planes.module.scss";
import { useState } from "react";

type Names = "Infrastructure" | "Services" | "Applications";
type Definition = { nodeTypes: NodeTypes };
type Planes = Record<Names, Definition>;

const PLANES: Planes = {
  Infrastructure: {
    nodeTypes: {
      [NodeType.PLATFORM]: Node,
      [NodeType.COMPUTE]: Node,
    },
  },
  Services: {
    nodeTypes: {
      [NodeType.SERVICE]: Node,
    },
  },
  Applications: {
    nodeTypes: {},
  },
};

const Planes = () => {
  const planeNames = Object.keys(PLANES) as Names[];
  const [active, setActive] = useState<Names>(planeNames[0] || "Infrastructure");

  return (
    <div className={styles.planes}>
      <div className={styles.container}>
        {planeNames.map((name) => (
          <div
            key={name}
            style={{ display: active === name ? "block" : "none", width: "100%", height: "100%" }}
          >
            <Canvas nodeTypes={PLANES[name].nodeTypes} />
          </div>
        ))}
      </div>
      <div className={styles.tabs}>
        {planeNames.map((name) => (
          <div key={name} className={styles.tab} onClick={() => setActive(name)}>
            {name}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Planes;

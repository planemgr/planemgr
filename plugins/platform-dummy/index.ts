import { NodeDefinition, NodeType, Plugin } from "@planemgr/plugin-core";

/**
 * Sample plugin implementation demonstrating the plugin API.
 */
export class DummpyPlatformPlugin implements Plugin {
  readonly name = "dummy-platform-plugin";
  readonly version = "1.0.0";

  getNodeDefinitions(): NodeDefinition[] {
    return [
      {
        id: "dummy-platform-node",
        type: NodeType.PLATFORM,
        label: "Dummy Platform",
        handles: {
          outputs: [
            { id: "out1", label: "Output 1" },
            { id: "out2", label: "Output 2" },
          ],
        },
      },
      {
        id: "dummy-compute-node",
        type: NodeType.COMPUTE,
        label: "Dummy Compute",
        handles: {
          inputs: [{ id: "in", label: "Input" }],
          outputs: [{ id: "out", label: "Output" }],
        },
      },
    ];
  }
}

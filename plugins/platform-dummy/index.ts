import { NodeDefinition, NodeType, Plugin } from "@planemgr/plugin-core";

/**
 * Sample plugin implementation demonstrating the plugin API.
 */
export class DummpyPlatformPlugin implements Plugin {
  readonly name = 'dummy-platform-plugin';
  readonly version = '1.0.0';

  getNodeDefinitions(): NodeDefinition[] {
    return [
      {
        id: 'dummy-platform-node',
        type: NodeType.PLATFORM,
        label: 'Dummy Platform',
      },
      {
        id: 'dummy-compute-node',
        type: NodeType.COMPUTE,
        label: 'Dummy Compute',
      },
    ];
  }
}

/**
 * Node type enum - defines the fixed list of supported node types.
 * 
 * @remarks
 * This enum is exhaustive and cannot be extended by plugins.
 * All node definitions must use one of these types.
 */
export enum NodeType {
  /**
   * Platform node type - represents infrastructure platforms
   * (e.g., AWS, Azure, GCP)
   */
  PLATFORM = 'platform',

  /**
   * Compute node type - represents computational resources
   * (e.g., VMs, Containers, or Bare Metal Servers)
   */
  COMPUTE = 'compute',

  /**
   * Service node type - represents auxiliary services running on compute nodes
   * (e.g., Databases, Caches, Message Queues)
   */
  SERVICE = 'service',
}

/**
 * Node definition provided by plugins.
 * 
 * @remarks
 * Each node definition describes a single node type that can be placed on the canvas.
 * 
 * @example
 * ```typescript
 * const nodeDefinition: NodeDefinition = {
 *   id: 'aws-ec2',
 *   type: NodeType.COMPUTE,
 *   label: 'EC2 Instance',
 * };
 * ```
 */
export interface NodeDefinition {
  /**
   * Unique identifier for this node definition.
   * 
   * @remarks
   * - MUST be unique across all plugins
   * - MUST contain only alphanumeric characters, hyphens, and underscores
   * - SHOULD follow the pattern: `{plugin-name}-{node-name}`
   * - MUST NOT be empty
   * - Maximum length: 100 characters
   * 
   * @example 'my-plugin-aws-ec2', 'custom_platform_labs'
   */
  id: string;

  /**
   * The type of this node from the fixed NodeType enum.
   * 
   * @remarks
   * - MUST be a valid value from the NodeType enum
   * - Determines how the node is rendered on the canvas
   */
  type: NodeType;

  /**
   * Display label for this node definition.
   * 
   * @remarks
   * - MUST NOT be empty
   * - Maximum length: 200 characters
   * - Should be human-readable and descriptive
   * - Will be displayed in the palette and potentially in tooltips
   * 
   * @example 'AWS EC2 Instance', 'Bare Metal Server'
   */
  label: string;
}

/**
 * Plugin interface that all plugins must implement.
 * 
 * @remarks
 * Plugins provide node definitions that extend the functionality of the canvas.
 * Each plugin is responsible for:
 * - Validating its own configuration
 * - Providing a unique name
 * - Returning an array of valid node definitions
 * 
 * @example
 * ```typescript
 * class MyPlugin implements Plugin {
 *   readonly name = 'my-plugin';
 *   readonly version = '1.0.0';
 *   
 *   getNodeDefinitions(): NodeDefinition[] {
 *     return [{
 *       id: 'my-plugin-node',
 *       type: NodeType.PLATFORM,
 *       label: 'My Custom Platform',
 *     }];
 *   }
 * }
 * ```
 */
export interface Plugin {
  /**
   * Unique name identifier for the plugin.
   * 
   * @remarks
   * - MUST be unique across all loaded plugins
   * - MUST contain only lowercase alphanumeric characters and hyphens
   * - MUST NOT start or end with a hyphen
   * - MUST NOT be empty
   * - Maximum length: 50 characters
   * 
   * @example 'aws-nodes', 'custom-infrastructure', 'my-service'
   */
  readonly name: string;

  /**
   * Semantic version of the plugin.
   * 
   * @remarks
   * - SHOULD follow semantic versioning (semver) format
   * - Used for debugging and compatibility checking
   * 
   * @example '1.0.0', '2.3.1-beta'
   */
  readonly version: string;

  /**
   * Returns the array of node definitions provided by this plugin.
   * 
   * @returns Array of node definitions. MUST NOT return null or undefined.
   *          MAY return an empty array if the plugin provides no nodes.
   * 
   * @throws Should NOT throw errors. If an error occurs, return an empty array
   *         and log the error internally.
   * 
   * @remarks
   * - MUST return a fresh array each time (do not return a shared reference)
   * - All node IDs MUST be unique within the plugin
   * - All node IDs SHOULD be prefixed with the plugin name
   * - The method MAY be called multiple times; results should be consistent
   * 
   * Edge cases:
   * - Empty array is valid (plugin provides no nodes)
   * - Duplicate IDs within a plugin will cause validation errors
   * - Invalid node types will cause validation errors
   * - Empty or overly long strings will cause validation errors
   */
  getNodeDefinitions(): NodeDefinition[];
}

/**
 * Validation error returned when a node definition is invalid.
 */
export interface ValidationError {
  /**
   * The plugin name where the error occurred
   */
  pluginName: string;

  /**
   * The node ID that failed validation (if applicable)
   */
  nodeId?: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * The field that failed validation (if applicable)
   */
  field?: string;
}

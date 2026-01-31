import * as z from "zod";

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
  PLATFORM = "platform",

  /**
   * Compute node type - represents computational resources
   * (e.g., VMs, Containers, or Bare Metal Servers)
   */
  COMPUTE = "compute",

  /**
   * Service node type - represents auxiliary services running on compute nodes
   * (e.g., Databases, Caches, Message Queues)
   */
  SERVICE = "service",
}

export const NodeTypeSchema = z.enum(
  NodeType,
  `Node type must be one of: ${Object.values(NodeType).join(", ")}`,
);

export const HandleConfigSchema = z.array(
  z.strictObject({
    /**
     * Unique identifier for this handle within the node.
     *
     * @remarks
     * - MUST be unique within the node's handles (both input and output)
     * - MUST contain only alphanumeric characters, hyphens, and underscores
     * - MUST NOT be empty
     * - Maximum length: 50 characters
     */
    id: z
      .string("Handle ID must be a string")
      .min(1, "Handle ID must be a non-empty string")
      .max(50, "Handle ID must not exceed 50 characters")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Handle ID must contain only alphanumeric characters, hyphens, and underscores",
      ),

    /**
     * Optional label for the handle.
     *
     * @remarks
     * - Maximum length: 100 characters
     * - Will be displayed near the handle if provided
     */
    label: z
      .string("Handle label must be a string")
      .max(100, "Handle label must not exceed 100 characters")
      .optional(),
  }),
);

/**
 * Handle configuration for a node.
 *
 * @remarks
 * Defines a single input or output connection point on a node.
 * Input handles are automatically positioned on the left.
 * Output handles are automatically positioned on the right.
 *
 * @example
 * ```typescript
 * const handle: HandleConfig = {
 *   id: 'input-1',
 *   label: 'Main Input',
 * };
 * ```
 */
export const NodeDefinitionSchema = z.strictObject({
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
  id: z
    .string("Node ID must be a string")
    .min(1, "Node ID must be a non-empty string")
    .max(100, "Node ID must not exceed 100 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Node ID must contain only alphanumeric characters, hyphens, and underscores",
    ),

  /**
   * The type of this node from the fixed NodeType enum.
   *
   * @remarks
   * - MUST be a valid value from the NodeType enum
   * - Determines how the node is rendered on the canvas
   */
  type: NodeTypeSchema,

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
  label: z
    .string("Node label must be a string")
    .min(1, "Node label must be a non-empty string")
    .max(200, "Node label must not exceed 200 characters"),

  /**
   * Optional handle configuration for this node.
   *
   * @remarks
   * - Defines input and output connection points
   * - If omitted, default handles based on node type will be used
   */
  handles: z
    .strictObject({
      /**
       * Input handles (target handles) for incoming connections.
       *
       * @remarks
       * - Each handle ID must be unique within this node
       * - Maximum 10 input handles per node
       * - Input handles MUST be positioned on the LEFT side
       */
      inputs: HandleConfigSchema.optional(),

      /**
       * Output handles (source handles) for outgoing connections.
       *
       * @remarks
       * - Each handle ID must be unique within this node
       * - Maximum 10 output handles per node
       * - Output handles MUST be positioned on the RIGHT side
       */
      outputs: HandleConfigSchema.optional(),
    })
    .optional(),
});

export type NodeDefinition = z.infer<typeof NodeDefinitionSchema>;

/**
 * @see Plugin.id
 */
export const PluginIdSchema = z
  .string("Plugin ID must be a string")
  .min(1, "Plugin ID must be a non-empty string")
  .max(50, "Plugin ID must not exceed 50 characters")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Plugin ID must contain only lowercase alphanumeric characters and hyphens",
  );

/**
 * @see Plugin.version
 */
export const PluginVersionSchema = z
  .string("Plugin version must be a string")
  .min(1, "Plugin version must be a non-empty string")
  .max(20, "Plugin version must not exceed 20 characters")
  .regex(
    /^[0-9]+(\.[0-9]+){2}(-[a-z0-9]+)?$/,
    "Plugin version must follow semantic versioning format",
  );

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
  readonly name: z.infer<typeof PluginIdSchema>;

  /**
   * Semantic version of the plugin.
   *
   * @remarks
   * - SHOULD follow semantic versioning (semver) format
   * - Used for debugging and compatibility checking
   *
   * @example '1.0.0', '2.3.1-beta'
   */
  readonly version: z.infer<typeof PluginVersionSchema>;

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

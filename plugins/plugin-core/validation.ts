import { NodeDefinition, NodeType, Plugin, ValidationError } from './types';

/**
 * Validates a node definition against the API requirements.
 * 
 * @param node - The node definition to validate
 * @param pluginName - The name of the plugin providing this node
 * @returns Array of validation errors, empty if valid
 */
export function validateNodeDefinition(
  node: NodeDefinition,
  pluginName: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate ID
  if (!node.id || typeof node.id !== 'string') {
    errors.push({
      pluginName,
      nodeId: node.id,
      field: 'id',
      message: 'Node ID must be a non-empty string',
    });
  } else if (node.id.length > 100) {
    errors.push({
      pluginName,
      nodeId: node.id,
      field: 'id',
      message: 'Node ID must not exceed 100 characters',
    });
  } else if (!/^[a-zA-Z0-9_-]+$/.test(node.id)) {
    errors.push({
      pluginName,
      nodeId: node.id,
      field: 'id',
      message:
        'Node ID must contain only alphanumeric characters, hyphens, and underscores',
    });
  }

  // Validate type
  if (!Object.values(NodeType).includes(node.type)) {
    errors.push({
      pluginName,
      nodeId: node.id,
      field: 'type',
      message: `Node type must be one of: ${Object.values(NodeType).join(', ')}`,
    });
  }

  // Validate label
  if (!node.label || typeof node.label !== 'string') {
    errors.push({
      pluginName,
      nodeId: node.id,
      field: 'label',
      message: 'Node label must be a non-empty string',
    });
  } else if (node.label.length > 200) {
    errors.push({
      pluginName,
      nodeId: node.id,
      field: 'label',
      message: 'Node label must not exceed 200 characters',
    });
  }

  return errors;
}

/**
 * Validates a plugin implementation.
 * 
 * @param plugin - The plugin to validate
 * @returns Array of validation errors, empty if valid
 */
export function validatePlugin(plugin: Plugin): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate name
  if (!plugin.name || typeof plugin.name !== 'string') {
    errors.push({
      pluginName: plugin.name || 'unknown',
      field: 'name',
      message: 'Plugin name must be a non-empty string',
    });
  } else if (plugin.name.length > 50) {
    errors.push({
      pluginName: plugin.name,
      field: 'name',
      message: 'Plugin name must not exceed 50 characters',
    });
  } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(plugin.name)) {
    errors.push({
      pluginName: plugin.name,
      field: 'name',
      message:
        'Plugin name must contain only lowercase alphanumeric characters and hyphens, and must not start or end with a hyphen',
    });
  }

  // Validate version
  if (!plugin.version || typeof plugin.version !== 'string') {
    errors.push({
      pluginName: plugin.name,
      field: 'version',
      message: 'Plugin version must be a non-empty string',
    });
  }

  // Validate getNodeDefinitions method
  if (typeof plugin.getNodeDefinitions !== 'function') {
    errors.push({
      pluginName: plugin.name,
      field: 'getNodeDefinitions',
      message: 'Plugin must implement getNodeDefinitions() method',
    });
    return errors; // Can't validate further without this method
  }

  // Validate node definitions
  try {
    const nodes = plugin.getNodeDefinitions();
    
    if (!Array.isArray(nodes)) {
      errors.push({
        pluginName: plugin.name,
        message: 'getNodeDefinitions() must return an array',
      });
      return errors;
    }

    const seenIds = new Set<string>();
    
    for (const node of nodes) {
      // Check for duplicate IDs within the plugin
      if (seenIds.has(node.id)) {
        errors.push({
          pluginName: plugin.name,
          nodeId: node.id,
          message: `Duplicate node ID '${node.id}' within plugin`,
        });
      }
      seenIds.add(node.id);

      // Validate the node definition
      const nodeErrors = validateNodeDefinition(node, plugin.name);
      errors.push(...nodeErrors);
    }
  } catch (error) {
    errors.push({
      pluginName: plugin.name,
      message: `getNodeDefinitions() threw an error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return errors;
}

/**
 * Checks for duplicate node IDs across multiple plugins.
 * 
 * @param plugins - Array of plugins to check
 * @returns Array of validation errors for duplicate IDs
 */
export function checkDuplicateNodeIds(plugins: Plugin[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const idToPlugins = new Map<string, string[]>();

  for (const plugin of plugins) {
    try {
      const nodes = plugin.getNodeDefinitions();
      
      for (const node of nodes) {
        const pluginsWithId = idToPlugins.get(node.id) || [];
        pluginsWithId.push(plugin.name);
        idToPlugins.set(node.id, pluginsWithId);
      }
    } catch {
      // Error already caught in validatePlugin
    }
  }

  for (const [nodeId, pluginNames] of idToPlugins) {
    if (pluginNames.length > 1) {
      errors.push({
        pluginName: pluginNames.join(', '),
        nodeId,
        message: `Node ID '${nodeId}' is defined in multiple plugins: ${pluginNames.join(', ')}`,
      });
    }
  }

  return errors;
}

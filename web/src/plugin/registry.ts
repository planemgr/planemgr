import * as z from "zod";

import { validatePlugin, NodeDefinition, Plugin } from "@planemgr/plugin-core";

/**
 * Plugin Registry - Central manager for all loaded plugins
 *
 * The registry is responsible for:
 * - Loading plugins from the configuration
 * - Validating plugins and their node definitions
 * - Providing access to all node definitions
 * - Logging validation errors
 */
export class PluginRegistry {
  private plugins: Plugin[] = [];
  private nodeDefinitions: NodeDefinition[] = [];

  /**
   * Loads plugins from the provided configuration.
   *
   * @param plugins - Array of plugin instances to load
   * @returns true if all plugins loaded successfully, false if there were errors
   */
  loadPlugins(plugins: Plugin[]): boolean {
    this.plugins = [];
    this.nodeDefinitions = [];

    let hasErrors = false;

    // Validate each plugin
    for (const plugin of plugins) {
      const errors = validatePlugin(plugin);

      if (errors) {
        hasErrors = true;

        const pluginNameString = z
          .string()
          .regex(/^[a-zA-Z0-9-_]+$/)
          .safeParse(plugin.name);
        const pluginNameForLog = pluginNameString.success
          ? pluginNameString.data.substring(0, 30)
          : "Unknown";

        console.error(`[${pluginNameForLog}] Plugin validation error:\n`, z.prettifyError(errors));
      } else {
        this.plugins.push(plugin);
      }
    }

    // Check for duplicate node IDs across plugins
    const pluginNameSet = new Set<string>(this.plugins.map((plugin) => plugin.name));
    if (pluginNameSet.size < this.plugins.length) {
      hasErrors = true;
      const duplicateNames = this.plugins
        .map((plugin) => plugin.name)
        .filter((name, index, arr) => arr.indexOf(name) !== index);
      for (const name of duplicateNames) {
        console.error("Plugin validation error:\n", ` ✖ Duplicate plugin name detected: '${name}'`);
      }
    }

    // Collect all node definitions from valid plugins
    if (!hasErrors) {
      for (const plugin of this.plugins) {
        try {
          const nodes = plugin.getNodeDefinitions();
          this.nodeDefinitions.push(...nodes);
        } catch (error) {
          console.error(`Error loading nodes from plugin '${plugin.name}':`, error);
        }
      }

      console.log(
        `Loaded ${this.plugins.length} plugin(s) with ${this.nodeDefinitions.length} node definition(s)`,
      );
    }

    return !hasErrors;
  }

  /**
   * Gets all loaded plugins.
   */
  getPlugins(): readonly Plugin[] {
    return this.plugins;
  }

  /**
   * Gets all node definitions from all loaded plugins.
   */
  getNodeDefinitions(): readonly NodeDefinition[] {
    return this.nodeDefinitions;
  }

  /**
   * Gets a node definition by its ID.
   */
  getNodeDefinitionById(id: string): NodeDefinition | undefined {
    return this.nodeDefinitions.find((node) => node.id === id);
  }

  /**
   * Checks if the registry has any loaded plugins.
   */
  hasPlugins(): boolean {
    return this.plugins.length > 0;
  }
}

// Global singleton instance
let registryInstance: PluginRegistry | null = null;

/**
 * Gets the global plugin registry instance.
 * Creates it if it doesn't exist.
 */
export function getPluginRegistry(): PluginRegistry {
  if (!registryInstance) {
    registryInstance = new PluginRegistry();
  }
  return registryInstance;
}

/**
 * Initializes the plugin system by loading plugins from the configuration file.
 */
export async function initializePlugins(): Promise<void> {
  const registry = getPluginRegistry();

  try {
    // Load the plugin configuration
    const pluginConfig = await import("../plugin.config");
    const plugins = pluginConfig.default || [];

    if (!Array.isArray(plugins)) {
      console.error("plugin.config.ts must export a default array of plugins");
      return;
    }

    const success = registry.loadPlugins(plugins);

    if (!success) {
      console.error("Plugin loading failed with errors. See above for details.");
    }
  } catch (error) {
    console.error("Failed to load plugin configuration:", error);
  }
}

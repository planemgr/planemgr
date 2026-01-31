import * as z from "zod";

import {
  type NodeDefinition,
  NodeDefinitionSchema,
  NodeType,
  NodeTypeSchema,
  Plugin,
  PluginIdSchema,
  PluginVersionSchema,
} from "./schema";

export const validateNodeType = (type: any): z.ZodError<NodeType> | undefined => {
  const result = NodeTypeSchema.safeParse(type, { reportInput: true });
  if (result.success) {
    return;
  }

  return result.error;
};

export const validateNodeDefinition = (node: any): z.ZodError<NodeDefinition> | undefined => {
  const result = NodeDefinitionSchema.safeParse(node, { reportInput: true });
  if (result.success) {
    return;
  }

  return result.error;
};

export const validatePlugin = (plugin: Plugin): z.ZodError<Plugin | string> | undefined => {
  const shapeResult = z.custom<Plugin>().safeParse(plugin, { reportInput: true });
  if (!shapeResult.success) {
    return shapeResult.error;
  }

  const idResult = PluginIdSchema.safeParse(plugin.name, { reportInput: true });
  if (!idResult.success) {
    return idResult.error;
  }

  const versionResult = PluginVersionSchema.safeParse(plugin.version, { reportInput: true });
  if (!versionResult.success) {
    return versionResult.error;
  }

  return;
};

# Plugin API Documentation

## Overview

The Planemanager plugin system allows third-party developers to extend the 
application by providing custom plaform implementations. A platform is a runtime
or PaaS service the end user can deploy services onto.

## Core Concepts

### Plugin Architecture

Plugins are simple JS files returning a list of node definitions for the node
types defined in `@planemgr/core`. Then the web interface will make it available
on the canvas to connec to other nodes.

### Node Types

Plugins can define nodes of the following types (defined in `NodeType` enum):

- `platform`: Infrastructure platforms (e.g., AWS, Azure, Home Lab)
- `compute`: Computational resources (e.g., VMs, containers, bare metal)
- `service`: Services running on top of compute (e.g. database, web server)

**Important**: The node type list is exhaustive and cannot be extended by plugins.

## Plugin Interface

### Required Interface

```typescript
interface Plugin {
  readonly name: string;
  readonly version: string;
  getNodeDefinitions(): NodeDefinition[];
}
```

### Node Definition

```typescript
interface NodeDefinition {
  id: string;
  type: NodeType;
  label: string;
}
```

## Field Requirements

### Plugin Name

**Constraints:**
- MUST be unique across all plugins
- MUST contain only lowercase alphanumeric characters and hyphens
- MUST NOT start or end with a hyphen
- MUST NOT be empty
- Maximum length: 50 characters

**Valid examples:** `aws-nodes`, `my-custom-plugin`, `infrastructure-v2`

**Invalid examples:** `-aws`, `aws-`, `AWS-Nodes`, `my_plugin`, `a`.repeat(51)

### Plugin Version

**Constraints:**
- MUST be a non-empty string
- SHOULD follow semantic versioning (e.g., `1.0.0`)

### Node ID

**Constraints:**
- MUST be unique across ALL plugins (not just within your plugin)
- MUST contain only alphanumeric characters, hyphens, and underscores
- MUST NOT be empty
- Maximum length: 100 characters
- SHOULD be prefixed with plugin name (e.g., `my-plugin-node-name`)

**Valid examples:** `my-plugin-aws-ec2`, `custom_node_123`, `plugin-v2-compute-1`

**Invalid examples:** `node with spaces`, `node@special`, empty string

### Node Type

**Constraints:**
- MUST be a value from the `NodeType` enum
- Only `NodeType.PLATFORM` or `NodeType.COMPUTE` are valid

### Node Label

**Constraints:**
- MUST NOT be empty
- Maximum length: 200 characters
- Should be human-readable and descriptive

**Valid examples:** `AWS EC2 Instance`, `Kubernetes Cluster`, `Azure Function`

## Example Plugin

```typescript
import { Plugin, NodeDefinition, NodeType } from '../plugin-api';

export class MyAwsPlugin implements Plugin {
  readonly name = 'aws-nodes';
  readonly version = '1.0.0';

  getNodeDefinitions(): NodeDefinition[] {
    return [
      {
        id: 'aws-nodes-ec2',
        type: NodeType.COMPUTE,
        label: 'EC2 Instance',
      },
      {
        id: 'aws-nodes-lambda',
        type: NodeType.COMPUTE,
        label: 'Lambda Function',
      },
      {
        id: 'aws-nodes-platform',
        type: NodeType.PLATFORM,
        label: 'AWS Account',
      },
    ];
  }
}
```

## Plugin Configuration

Plugins are registered in `plugin.config.ts`:

```typescript
import { Plugin } from './plugin-api';
import { MyAwsPlugin } from './plugins/my-aws-plugin';
import { MyAzurePlugin } from './plugins/my-azure-plugin';

const plugins: Plugin[] = [
  new MyAwsPlugin(),
  new MyAzurePlugin(),
];

export default plugins;
```

## Validation

All plugins and node definitions are validated at startup. Validation checks:

1. Plugin name format and uniqueness
2. Plugin version presence
3. Node ID format and uniqueness (within plugin and across all plugins)
4. Node type validity
5. Node label presence and length
6. `getNodeDefinitions()` method existence

Validation errors will be logged to the console and prevent the plugin from loading.

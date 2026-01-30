import { Plugin } from '@planemgr/plugin-core';
import { DummpyPlatformPlugin } from '@planemgr/platform-dummy';

/**
 * Plugin Configuration File
 * 
 * This file defines all plugins to be loaded by the application.
 * 
 * @example
 * ```typescript
 * import { MyCustomPlugin } from './plugins/my-custom-plugin';
 * 
 * export default [
 *   new SamplePlugin(),
 *   new MyCustomPlugin(),
 * ];
 * ```
 */
const plugins: Plugin[] = [
  new DummpyPlatformPlugin(),
];

export default plugins;

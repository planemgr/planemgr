import { IacStorage } from "./iac.js";

export const createStorage = (options: { iacDir: string }) => new IacStorage(options.iacDir);

export { IacStorage } from "./iac.js";
export type { Storage } from "./storage.js";

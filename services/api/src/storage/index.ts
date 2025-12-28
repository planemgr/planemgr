import { IacStorage } from "./iac";

export const createStorage = (options: { iacDir: string }) => new IacStorage(options.iacDir);

export { IacStorage } from "./iac";
export type { Storage } from "./storage";

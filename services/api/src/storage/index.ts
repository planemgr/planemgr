import { createPool } from "../db";
import { PostgresStorage } from "./postgres";

export const createStorage = (databaseUrl: string) => {
  const pool = createPool(databaseUrl);
  return new PostgresStorage(pool);
};

export { PostgresStorage } from "./postgres";
export type { Storage } from "./storage";

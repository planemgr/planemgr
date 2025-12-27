import { Pool } from "pg";

export const createPool = (connectionString: string) =>
  new Pool({
    connectionString
  });

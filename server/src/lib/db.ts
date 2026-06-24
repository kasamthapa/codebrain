import { Pool } from "pg";
import { env } from "../config/env";

const db = new Pool({
  connectionString: env.DATABASE_URL,
});

export default db;

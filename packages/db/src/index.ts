import { env } from "@se-project/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export const db = drizzle(env.DATABASE_URL, { schema });

export { eq, and, or, ilike, sql, desc, asc, count, inArray } from "drizzle-orm";

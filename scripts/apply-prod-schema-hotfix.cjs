const { Client } = require("pg");

async function run() {
  const conn = process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL is not set");

  const client = new Client({ connectionString: conn });
  await client.connect();

  const statements = [
    `ALTER TABLE public.vendor ADD COLUMN IF NOT EXISTS created_by text;`,
    `ALTER TABLE public.equipment_item ADD COLUMN IF NOT EXISTS created_by text;`,
    `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'vendor_created_by_user_id_fk'
        ) THEN
          ALTER TABLE public.vendor
            ADD CONSTRAINT vendor_created_by_user_id_fk
            FOREIGN KEY (created_by)
            REFERENCES public."user"(id)
            ON DELETE RESTRICT;
        END IF;
      END
    $$;`,
    `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'equipment_item_created_by_user_id_fk'
        ) THEN
          ALTER TABLE public.equipment_item
            ADD CONSTRAINT equipment_item_created_by_user_id_fk
            FOREIGN KEY (created_by)
            REFERENCES public."user"(id)
            ON DELETE RESTRICT;
        END IF;
      END
    $$;`,
    `CREATE INDEX IF NOT EXISTS vendor_created_by_idx ON public.vendor(created_by);`,
    `CREATE INDEX IF NOT EXISTS equipment_item_created_by_idx ON public.equipment_item(created_by);`,
  ];

  for (const statement of statements) {
    await client.query(statement);
  }

  const verify = await client.query(`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and ((table_name = 'vendor' and column_name = 'created_by')
           or (table_name = 'equipment_item' and column_name = 'created_by'))
    order by table_name;
  `);

  console.log("applied_and_verified:", JSON.stringify(verify.rows, null, 2));
  await client.end();
}

run().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});

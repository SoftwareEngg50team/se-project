ALTER TABLE "vendor" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "equipment_item" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_item" ADD CONSTRAINT "equipment_item_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_created_by_idx" ON "vendor" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "equipment_item_created_by_idx" ON "equipment_item" USING btree ("created_by");
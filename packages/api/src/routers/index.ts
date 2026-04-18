import { z } from "zod";
import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { eventsRouter } from "./events";
import { equipmentRouter } from "./equipment";
import { equipmentAssignmentsRouter } from "./equipment-assignments";
import { staffRouter } from "./staff";
import { staffAssignmentsRouter } from "./staff-assignments";
import { attendanceRouter } from "./attendance";
import { expensesRouter } from "./expenses";
import { vendorsRouter } from "./vendors";
import { invoicesRouter } from "./invoices";
import { paymentsRouter } from "./payments";
import { dashboardRouter } from "./dashboard";
import { notificationsRouter } from "./notifications";
import { profileRouter } from "./profile";
import { chatRouter } from "./chat";

export const appRouter = {
  healthCheck: publicProcedure
    .route({ tags: ["Health"], summary: "Health check", description: "Returns OK when the API is running." })
    .output(z.string())
    .handler(() => {
      return "OK";
    }),
  events: eventsRouter,
  equipment: equipmentRouter,
  equipmentAssignments: equipmentAssignmentsRouter,
  staff: staffRouter,
  staffAssignments: staffAssignmentsRouter,
  attendance: attendanceRouter,
  expenses: expensesRouter,
  vendors: vendorsRouter,
  invoices: invoicesRouter,
  payments: paymentsRouter,
  dashboard: dashboardRouter,
  notifications: notificationsRouter,
  profile: profileRouter,
  chat: chatRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;

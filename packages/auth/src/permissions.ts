import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  event: ["create", "read", "update", "delete"],
  equipment: ["create", "read", "update", "delete", "assign"],
  staff: ["read", "assign", "manage_attendance"],
  finance: ["read", "create", "update", "approve"],
  invoice: ["create", "read", "update"],
  report: ["read"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  event: ["create", "read", "update", "delete"],
  equipment: ["create", "read", "update", "delete", "assign"],
  staff: ["read", "assign", "manage_attendance"],
  finance: ["read", "create", "update", "approve"],
  invoice: ["create", "read", "update"],
  report: ["read"],
});

export const eventHead = ac.newRole({
  member: ["create"],
  invitation: ["create"],
  event: ["create", "read", "update"],
  equipment: ["read", "update", "assign"],
  staff: ["read", "assign", "manage_attendance"],
  finance: ["read", "create"],
  invoice: ["create", "read"],
  report: ["read"],
});

export const staff = ac.newRole({
  event: ["read"],
  equipment: ["read"],
  staff: ["read"],
});

import { StaffDetailView } from "./staff-detail-view";

export default function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <StaffDetailView paramsPromise={params} />;
}

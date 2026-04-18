import { EventDetailView } from "./event-detail-view";

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EventDetailView paramsPromise={params} />;
}

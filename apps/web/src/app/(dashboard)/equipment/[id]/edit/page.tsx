"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { EquipmentForm } from "@/components/equipment/equipment-form";

export default function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: equipmentData, isLoading } = useQuery(
    orpc.equipment.getById.queryOptions({ input: { id } }),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading equipment...</p>
      </div>
    );
  }

  if (!equipmentData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Equipment not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Equipment</h1>
        <p className="text-muted-foreground">
          Update the details for {equipmentData.name}.
        </p>
      </div>
      <EquipmentForm
        equipmentId={id}
        defaultValues={{
          name: equipmentData.name,
          categoryId: equipmentData.categoryId,
          status: equipmentData.status,
          purchaseDate: equipmentData.purchaseDate
            ? new Date(equipmentData.purchaseDate).toISOString().split("T")[0]!
            : "",
          purchaseCost: equipmentData.purchaseCost != null ? String(equipmentData.purchaseCost) : "",
          notes: equipmentData.notes ?? "",
        }}
      />
    </div>
  );
}

import { EquipmentForm } from "@/components/equipment/equipment-form";

export default function NewEquipmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add Equipment</h1>
        <p className="text-muted-foreground">
          Fill in the details to add a new equipment item.
        </p>
      </div>
      <EquipmentForm />
    </div>
  );
}

import { TableSkeleton } from "@/components/ui/data-table";

export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <div className="mb-6 flex flex-col gap-2">
        <div className="h-3 w-32 rounded bg-sunken" />
        <div className="h-7 w-64 rounded bg-sunken" />
        <div className="h-4 w-96 max-w-full rounded bg-sunken" />
      </div>
      <TableSkeleton />
    </div>
  );
}

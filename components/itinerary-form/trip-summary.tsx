import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParticipantType, TripFormValues } from "@/lib/schema";

interface TripSummaryProps {
  data: TripFormValues;
  onEdit: () => void;
}

const TYPE_LABELS: Record<ParticipantType, string> = {
  bambino: "Bambino",
  ragazzo: "Ragazzo",
  adulto: "Adulto",
};

export function TripSummary({ data, onEdit }: TripSummaryProps) {
  return (
    <Card className="relative mx-auto w-full max-w-2xl overflow-hidden shadow-[0_20px_50px_-12px_color-mix(in_oklch,var(--primary)_25%,transparent)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
      <CardHeader className="px-8 pt-8">
        <CardTitle className="font-display text-2xl font-semibold">Riepilogo viaggio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-8 pb-8">
        <div>
          <p className="text-sm text-muted-foreground">Destinazione</p>
          <p className="font-medium">{data.destination}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Date</p>
          <p className="font-medium">
            {data.dateRange.from && data.dateRange.to
              ? `${format(data.dateRange.from, "dd/MM/yyyy")} - ${format(data.dateRange.to, "dd/MM/yyyy")}`
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Partecipanti</p>
          <ul className="list-inside list-disc font-medium">
            {data.participants.map((p, i) => (
              <li key={i}>
                {TYPE_LABELS[p.type]}, {p.age} anni
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Budget indicativo</p>
          <p className="font-medium">{data.budget}€</p>
        </div>
        {data.styleNotes && (
          <div>
            <p className="text-sm text-muted-foreground">Note sullo stile</p>
            <p className="font-medium">{data.styleNotes}</p>
          </div>
        )}
        <Button type="button" variant="outline" onClick={onEdit} className="w-full">
          Modifica
        </Button>
      </CardContent>
    </Card>
  );
}

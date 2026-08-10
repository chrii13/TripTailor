import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripFormValues } from "@/lib/schema";

interface TripSummaryProps {
  data: TripFormValues;
  onEdit: () => void;
}

export function TripSummary({ data, onEdit }: TripSummaryProps) {
  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Riepilogo viaggio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
                {p.type === "adulto" ? "Adulto" : "Bambino"}, {p.age} anni
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

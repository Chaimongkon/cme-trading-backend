"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";

interface StrikeRow {
  strike: number;
  putOi: number | null;
  callOi: number | null;
  volSettle?: number | null;
  range?: string | null;
  putChange?: number;
  callChange?: number;
}

interface DataTableProps {
  data: StrikeRow[];
  currentPrice?: number;
  title?: string;
}

export function DataTable({
  data,
  currentPrice = 0,
  title = "ข้อมูล Strike",
}: DataTableProps) {
  // Find ATM strike (closest to current price)
  const atmStrike = data.reduce(
    (closest, row) =>
      Math.abs(row.strike - currentPrice) < Math.abs(closest - currentPrice)
        ? row.strike
        : closest,
    data[0]?.strike || 0
  );

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-auto">
          <table className="data-table">
            <thead className="sticky top-0 bg-card z-10">
              <tr>
                <th>Strike</th>
                <th className="text-right">Put OI</th>
                <th className="text-right">Call OI</th>
                <th className="text-right">Put Chg</th>
                <th className="text-right">Call Chg</th>
                <th className="text-right">Vol Settle</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                const isAtm = row.strike === atmStrike;
                const isItmPut = row.strike > currentPrice;
                const isItmCall = row.strike < currentPrice;

                return (
                  <tr
                    key={idx}
                    className={cn(
                      isAtm && "bg-primary/10 border-l-2 border-l-primary"
                    )}
                  >
                    <td
                      className={cn(
                        "font-medium",
                        isAtm && "text-primary font-bold"
                      )}
                    >
                      {row.strike.toFixed(0)}
                      {isAtm && (
                        <span className="ml-2 text-xs text-primary">(ATM)</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "text-right",
                        isItmPut ? "text-red-400" : "text-muted-foreground"
                      )}
                    >
                      {formatNumber(row.putOi || 0, 0)}
                    </td>
                    <td
                      className={cn(
                        "text-right",
                        isItmCall ? "text-green-400" : "text-muted-foreground"
                      )}
                    >
                      {formatNumber(row.callOi || 0, 0)}
                    </td>
                    <td
                      className={cn(
                        "text-right",
                        (row.putChange || 0) > 0
                          ? "text-red-400"
                          : (row.putChange || 0) < 0
                            ? "text-green-400"
                            : "text-muted-foreground"
                      )}
                    >
                      {row.putChange !== undefined && row.putChange !== 0
                        ? (row.putChange > 0 ? "+" : "") +
                        formatNumber(row.putChange, 0)
                        : "-"}
                    </td>
                    <td
                      className={cn(
                        "text-right",
                        (row.callChange || 0) > 0
                          ? "text-green-400"
                          : (row.callChange || 0) < 0
                            ? "text-red-400"
                            : "text-muted-foreground"
                      )}
                    >
                      {row.callChange !== undefined && row.callChange !== 0
                        ? (row.callChange > 0 ? "+" : "") +
                        formatNumber(row.callChange, 0)
                        : "-"}
                    </td>
                    <td className="text-right text-muted-foreground">
                      {row.volSettle ? formatNumber(row.volSettle, 2) + "%" : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

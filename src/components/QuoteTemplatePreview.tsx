import { useMemo } from "react";
import type { TemplateBlock } from "@/components/QuoteTemplateBuilder";

interface Props {
  blocks: TemplateBlock[];
  templateName: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

const QuoteTemplatePreview = ({ blocks, templateName }: Props) => {
  const { subtotal, optionalTotal } = useMemo(() => {
    let sub = 0;
    let opt = 0;
    for (const b of blocks) {
      if (b.type === "item_group" && b.items) {
        for (const i of b.items) {
          if (i.description) sub += (i.qty || 0) * (i.unit_price || 0);
        }
      }
      if (b.type === "optional_group" && b.optionalItems) {
        for (const o of b.optionalItems) {
          if (o.description) opt += o.price || 0;
        }
      }
    }
    return { subtotal: sub, optionalTotal: opt };
  }, [blocks]);

  const hasContent = blocks.some(
    (b) =>
      (b.type === "heading" && b.heading) ||
      (b.type === "text" && b.text) ||
      (b.type === "item_group" && b.items?.some((i) => i.description)) ||
      (b.type === "optional_group" && b.optionalItems?.some((o) => o.description)) ||
      b.type === "divider"
  );

  return (
    <div className="border rounded-lg bg-background p-6 space-y-4 text-sm min-h-[300px]">
      {/* Header */}
      <div className="border-b pb-3 mb-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Offerte preview</p>
        <h3 className="text-base font-semibold text-foreground mt-1">
          {templateName || "Naamloos sjabloon"}
        </h3>
      </div>

      {!hasContent && (
        <p className="text-muted-foreground text-center py-8">
          Voeg blokken toe om een preview te zien
        </p>
      )}

      {blocks.map((block) => {
        switch (block.type) {
          case "heading":
            return block.heading ? (
              <h4 key={block.id} className="font-semibold text-foreground text-sm pt-2">
                {block.heading}
              </h4>
            ) : null;

          case "text":
            return block.text ? (
              <p key={block.id} className="text-muted-foreground whitespace-pre-wrap text-xs leading-relaxed">
                {block.text}
              </p>
            ) : null;

          case "divider":
            return <hr key={block.id} className="border-border my-2" />;

          case "item_group": {
            const items = (block.items ?? []).filter((i) => i.description);
            if (items.length === 0) return null;
            return (
              <table key={block.id} className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1.5 font-medium">Omschrijving</th>
                    <th className="text-right py-1.5 font-medium w-16">Aantal</th>
                    <th className="text-right py-1.5 font-medium w-20">Prijs</th>
                    <th className="text-right py-1.5 font-medium w-20">Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 text-foreground">{item.description}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{item.qty}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{fmt(item.unit_price)}</td>
                      <td className="py-1.5 text-right font-medium text-foreground">
                        {fmt((item.qty || 0) * (item.unit_price || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          }

          case "optional_group": {
            const opts = (block.optionalItems ?? []).filter((o) => o.description);
            if (opts.length === 0) return null;
            return (
              <div key={block.id} className="bg-muted/30 rounded-md p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Optioneel
                </p>
                {opts.map((opt, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-foreground">{opt.description}</span>
                    <span className="text-muted-foreground font-medium">{fmt(opt.price)}</span>
                  </div>
                ))}
              </div>
            );
          }

          default:
            return null;
        }
      })}

      {/* Totals */}
      {subtotal > 0 && (
        <div className="border-t pt-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Subtotaal</span>
            <span className="font-medium text-foreground">{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">BTW (21%)</span>
            <span className="font-medium text-foreground">{fmt(subtotal * 0.21)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold pt-1 border-t">
            <span>Totaal</span>
            <span>{fmt(subtotal * 1.21)}</span>
          </div>
          {optionalTotal > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground pt-1">
              <span>+ optioneel</span>
              <span>{fmt(optionalTotal)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuoteTemplatePreview;

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Type,
  FileText,
  Minus,
  List,
  ListChecks,
} from "lucide-react";
import type { QuoteItem, OptionalItem } from "@/hooks/useQuotes";

/* ── Block Types ── */
export type BlockType = "item_group" | "heading" | "text" | "divider" | "optional_group";

export interface TemplateBlock {
  id: string;
  type: BlockType;
  heading?: string;
  text?: string;
  items?: QuoteItem[];
  optionalItems?: OptionalItem[];
}

const uid = () => crypto.randomUUID();

const emptyItem = (): QuoteItem => ({ description: "", qty: 1, unit_price: 0, total: 0 });
const emptyOptional = (): OptionalItem => ({ description: "", price: 0 });

const BLOCK_META: Record<BlockType, { label: string; icon: React.ElementType }> = {
  item_group: { label: "Artikelgroep", icon: List },
  heading: { label: "Koptekst", icon: Type },
  text: { label: "Vrije tekst", icon: FileText },
  divider: { label: "Scheidingslijn", icon: Minus },
  optional_group: { label: "Optionele items", icon: ListChecks },
};

/* ── Helpers to derive legacy arrays ── */
export function blocksToLegacy(blocks: TemplateBlock[]) {
  const items: QuoteItem[] = [];
  const optional_items: OptionalItem[] = [];
  for (const b of blocks) {
    if (b.type === "item_group" && b.items) {
      items.push(...b.items.filter((i) => i.description));
    }
    if (b.type === "optional_group" && b.optionalItems) {
      optional_items.push(...b.optionalItems.filter((o) => o.description));
    }
  }
  return { items, optional_items };
}

export function legacyToBlocks(items: QuoteItem[], optionalItems: OptionalItem[]): TemplateBlock[] {
  const blocks: TemplateBlock[] = [];
  if (items.length > 0) {
    blocks.push({ id: uid(), type: "item_group", items: items.map((i) => ({ ...i })) });
  }
  if (optionalItems.length > 0) {
    blocks.push({ id: uid(), type: "optional_group", optionalItems: optionalItems.map((o) => ({ ...o })) });
  }
  if (blocks.length === 0) {
    blocks.push({ id: uid(), type: "item_group", items: [emptyItem()] });
  }
  return blocks;
}

/* ── Component ── */
interface Props {
  blocks: TemplateBlock[];
  onChange: (blocks: TemplateBlock[]) => void;
}

const QuoteTemplateBuilder = ({ blocks, onChange }: Props) => {
  const [dragBlockIdx, setDragBlockIdx] = useState<number | null>(null);
  const [dragItemInfo, setDragItemInfo] = useState<{ blockIdx: number; itemIdx: number } | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<{ blockIdx: number; itemIdx: number } | null>(null);

  const update = (fn: (draft: TemplateBlock[]) => void) => {
    const copy = blocks.map((b) => ({
      ...b,
      items: b.items?.map((i) => ({ ...i })),
      optionalItems: b.optionalItems?.map((o) => ({ ...o })),
    }));
    fn(copy);
    onChange(copy);
  };

  const moveBlock = (from: number, to: number) => {
    if (from === to) return;
    update((draft) => {
      const [moved] = draft.splice(from, 1);
      draft.splice(to, 0, moved);
    });
  };

  const addBlock = (type: BlockType) => {
    const newBlock: TemplateBlock = { id: uid(), type };
    if (type === "item_group") newBlock.items = [emptyItem()];
    if (type === "optional_group") newBlock.optionalItems = [emptyOptional()];
    if (type === "heading") newBlock.heading = "";
    if (type === "text") newBlock.text = "";
    onChange([...blocks, newBlock]);
  };

  const removeBlock = (idx: number) => {
    onChange(blocks.filter((_, i) => i !== idx));
  };

  const recalcItem = (item: QuoteItem): QuoteItem => ({
    ...item,
    total: Number((item.qty * item.unit_price).toFixed(2)),
  });

  /* ── Block-level drag ── */
  const onBlockDragStart = (e: React.DragEvent, idx: number) => {
    setDragBlockIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "block");
  };

  const onBlockDragOver = (e: React.DragEvent, idx: number) => {
    if (dragBlockIdx === null) return;
    e.preventDefault();
    dragOverRef.current = idx;
  };

  const onBlockDragEnd = () => {
    if (dragBlockIdx !== null && dragOverRef.current !== null) {
      moveBlock(dragBlockIdx, dragOverRef.current);
    }
    setDragBlockIdx(null);
    dragOverRef.current = null;
  };

  /* ── Item-level drag (within same block) ── */
  const onItemDragStart = (e: React.DragEvent, blockIdx: number, itemIdx: number) => {
    e.stopPropagation();
    setDragItemInfo({ blockIdx, itemIdx });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "item");
  };

  const onItemDragOver = (e: React.DragEvent, blockIdx: number, itemIdx: number) => {
    if (!dragItemInfo || dragItemInfo.blockIdx !== blockIdx) return;
    e.preventDefault();
    e.stopPropagation();
    dragOverItemRef.current = { blockIdx, itemIdx };
  };

  const onItemDragEnd = () => {
    if (dragItemInfo && dragOverItemRef.current && dragItemInfo.blockIdx === dragOverItemRef.current.blockIdx) {
      const { blockIdx } = dragItemInfo;
      const from = dragItemInfo.itemIdx;
      const to = dragOverItemRef.current.itemIdx;
      if (from !== to) {
        update((draft) => {
          const block = draft[blockIdx];
          const arr: any[] = block.type === "optional_group" ? block.optionalItems! : block.items!;
          const [moved] = arr.splice(from, 1);
          arr.splice(to, 0, moved);
        });
      }
    }
    setDragItemInfo(null);
    dragOverItemRef.current = null;
  };

  const renderItemGroup = (block: TemplateBlock, blockIdx: number) => (
    <div className="space-y-2">
      {(block.items ?? []).map((item, idx) => (
        <div
          key={idx}
          className="flex gap-2 items-center group"
          draggable
          onDragStart={(e) => onItemDragStart(e, blockIdx, idx)}
          onDragOver={(e) => onItemDragOver(e, blockIdx, idx)}
          onDragEnd={onItemDragEnd}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          <Input
            placeholder="Omschrijving"
            value={item.description}
            onChange={(e) =>
              update((d) => { d[blockIdx].items![idx].description = e.target.value; })
            }
            className="flex-1"
          />
          <Input
            type="number"
            placeholder="Aantal"
            value={item.qty || ""}
            onChange={(e) =>
              update((d) => {
                d[blockIdx].items![idx].qty = Number(e.target.value) || 0;
                d[blockIdx].items![idx] = recalcItem(d[blockIdx].items![idx]);
              })
            }
            className="w-20"
          />
          <Input
            type="number"
            placeholder="Prijs"
            value={item.unit_price || ""}
            onChange={(e) =>
              update((d) => {
                d[blockIdx].items![idx].unit_price = Number(e.target.value) || 0;
                d[blockIdx].items![idx] = recalcItem(d[blockIdx].items![idx]);
              })
            }
            className="w-24"
          />
          {(block.items?.length ?? 0) > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => update((d) => { d[blockIdx].items = d[blockIdx].items!.filter((_, i) => i !== idx); })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => update((d) => { d[blockIdx].items!.push(emptyItem()); })}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Artikel
      </Button>
    </div>
  );

  const renderOptionalGroup = (block: TemplateBlock, blockIdx: number) => (
    <div className="space-y-2">
      {(block.optionalItems ?? []).map((opt, idx) => (
        <div
          key={idx}
          className="flex gap-2 items-center group"
          draggable
          onDragStart={(e) => onItemDragStart(e, blockIdx, idx)}
          onDragOver={(e) => onItemDragOver(e, blockIdx, idx)}
          onDragEnd={onItemDragEnd}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          <Input
            placeholder="Omschrijving"
            value={opt.description}
            onChange={(e) =>
              update((d) => { d[blockIdx].optionalItems![idx].description = e.target.value; })
            }
            className="flex-1"
          />
          <Input
            type="number"
            placeholder="Prijs"
            value={opt.price || ""}
            onChange={(e) =>
              update((d) => { d[blockIdx].optionalItems![idx].price = Number(e.target.value) || 0; })
            }
            className="w-24"
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => update((d) => { d[blockIdx].optionalItems = d[blockIdx].optionalItems!.filter((_, i) => i !== idx); })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => update((d) => { d[blockIdx].optionalItems!.push(emptyOptional()); })}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Optioneel item
      </Button>
    </div>
  );

  const renderBlockContent = (block: TemplateBlock, blockIdx: number) => {
    switch (block.type) {
      case "item_group":
        return renderItemGroup(block, blockIdx);
      case "optional_group":
        return renderOptionalGroup(block, blockIdx);
      case "heading":
        return (
          <Input
            placeholder="Sectietitel…"
            value={block.heading ?? ""}
            onChange={(e) => update((d) => { d[blockIdx].heading = e.target.value; })}
            className="font-semibold"
          />
        );
      case "text":
        return (
          <Textarea
            placeholder="Vrije tekst…"
            value={block.text ?? ""}
            onChange={(e) => update((d) => { d[blockIdx].text = e.target.value; })}
            rows={3}
          />
        );
      case "divider":
        return <hr className="border-border" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => {
        const meta = BLOCK_META[block.type];
        const Icon = meta.icon;
        return (
          <div
            key={block.id}
            className={`border rounded-lg bg-card transition-shadow ${dragBlockIdx === idx ? "opacity-50 shadow-lg" : ""}`}
            draggable
            onDragStart={(e) => onBlockDragStart(e, idx)}
            onDragOver={(e) => onBlockDragOver(e, idx)}
            onDragEnd={onBlockDragEnd}
          >
            {/* Block toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50 rounded-t-lg">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={idx === 0}
                  onClick={() => moveBlock(idx, idx - 1)}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={idx === blocks.length - 1}
                  onClick={() => moveBlock(idx, idx + 1)}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeBlock(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {/* Block content */}
            <div className="p-3">{renderBlockContent(block, idx)}</div>
          </div>
        );
      })}

      {/* Add block buttons */}
      <div className="flex flex-wrap gap-2 pt-2">
        {(Object.keys(BLOCK_META) as BlockType[]).map((type) => {
          const meta = BLOCK_META[type];
          const Icon = meta.icon;
          return (
            <Button key={type} variant="outline" size="sm" onClick={() => addBlock(type)}>
              <Icon className="h-3.5 w-3.5 mr-1" /> {meta.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default QuoteTemplateBuilder;

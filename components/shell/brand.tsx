import { Icon } from "@/components/ui/icon";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid h-[38px] w-[38px] place-items-center rounded-[11px] text-white ${
          light ? "bg-white/10" : "bg-navy"
        }`}
      >
        <Icon name="door" size={24} />
      </div>
      <div>
        <div
          className={`text-[17px] font-bold tracking-wide ${light ? "text-white" : "text-navy"}`}
        >
          ミエルーム
        </div>
        <div
          className={`text-[11px] tracking-wider ${light ? "text-white/50" : "text-muted"}`}
        >
          教室・先生ナビ
        </div>
      </div>
    </div>
  );
}

import { BrandMark } from "./brand-mark";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
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

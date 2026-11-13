import { FloorMap } from "@/components/screens/floor-map";
import type { RoomStates } from "@/lib/domain/floor-plan";
import type { MonitorChips } from "@/lib/domain/monitor";

// S30 モニター (外部設計書 06-4): 1920×1080 に収める。操作はなし。上の帯に、いまの状態
// (いま・次、休み時間)、中央に 6 階分のフロアマップ、下に色の説明。
//
// The design is a 1920×1080 canvas. It is scaled to fit any screen (1280×720 up to 4K)
// with CSS only, no inline styles: the canvas is the largest 16:9 box that fits the
// viewport, and every size inside is written in canvas pixels through --u
// (1 canvas pixel = 1/1920 of the canvas width, a container query unit).

const CHIP_TONE = {
  lesson: "bg-[#2f6fe4] text-white",
  break: "bg-[#f6b73c] text-[#3a2a00]",
  ended: "bg-white/20 text-white",
  secondary: "bg-white/15 text-white",
  secondaryBreak: "bg-[#2f6fe4] text-white",
} as const;

const chipClass =
  "grid h-[calc(50*var(--u))] place-items-center whitespace-nowrap rounded-full px-[calc(34*var(--u))] text-[length:calc(26*var(--u))] font-extrabold";

export function MonitorView({
  chips,
  states,
  dateText,
  timeText,
  updatedText,
  stale,
}: {
  chips: MonitorChips;
  states: RoomStates;
  dateText: string;
  timeText: string;
  updatedText: string;
  /** データを 2 分続けて取れなかった: 最終更新の時刻を赤にする */
  stale: boolean;
}) {
  const isBreak = chips.primary.tone === "break";
  const legend = [
    isBreak
      ? {
          label: "次の授業",
          swatch: "border-2 border-dashed border-[#2f6fe4] bg-[#e3edff]",
        }
      : { label: "授業中", swatch: "border-2 border-[#1b4fb0] bg-[#2f6fe4]" },
    { label: "予約使用中", swatch: "border-2 border-[#c98a0c] bg-[#f6b73c]" },
    { label: "空き", swatch: "border-2 border-[#2e9e57] bg-[#d7f2de]" },
    {
      label: "使用止め",
      swatch:
        "border-2 border-[#7b8088] bg-[repeating-linear-gradient(45deg,#dcdee3_0_6px,#b9bdc5_6px_12px)]",
    },
  ];
  return (
    // The viewport (a size container), letterboxed in navy when it is not 16:9.
    <div className="fixed inset-0 grid place-items-center overflow-hidden bg-[#0b1f3a] [container-type:size]">
      {/* The canvas: the largest 16:9 box that fits, and the container --u refers to. */}
      <div className="aspect-video w-[min(100cqw,calc(100cqh*16/9))] [container-type:inline-size]">
        <div className="flex h-full flex-col text-[length:calc(22*var(--u))] leading-tight text-white [--u:calc(100cqw/1920)]">
          <header className="flex h-[calc(92*var(--u))] shrink-0 items-center gap-[calc(24*var(--u))] px-[calc(40*var(--u))]">
            <div className="text-[length:calc(40*var(--u))] font-bold tracking-wide">
              ミエルーム
            </div>
            <div className="ml-[calc(40*var(--u))] flex items-center gap-[calc(16*var(--u))]">
              <div className={`${chipClass} ${CHIP_TONE[chips.primary.tone]}`}>
                {chips.primary.text}
              </div>
              {chips.secondary !== null && (
                <div
                  className={`${chipClass} ${isBreak ? CHIP_TONE.secondaryBreak : CHIP_TONE.secondary}`}
                >
                  {chips.secondary}
                </div>
              )}
            </div>
            <div className="ml-auto flex items-baseline gap-[calc(40*var(--u))]">
              <div className="text-[length:calc(38*var(--u))] font-bold">
                {dateText} {timeText}
              </div>
              <div
                className={stale ? "font-bold text-[#ff8f8f]" : "text-white/70"}
              >
                最終更新 {updatedText}
              </div>
            </div>
          </header>
          <div className="h-[calc(950*var(--u))] shrink-0">
            <FloorMap states={states} />
          </div>
          <footer className="flex h-[calc(38*var(--u))] shrink-0 items-center gap-[calc(36*var(--u))] px-[calc(40*var(--u))]">
            {legend.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-[calc(10*var(--u))]"
              >
                <span
                  className={`inline-block h-[calc(18*var(--u))] w-[calc(30*var(--u))] rounded-[calc(3*var(--u))] ${item.swatch}`}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </footer>
        </div>
      </div>
    </div>
  );
}

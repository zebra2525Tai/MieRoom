// S30 モニター (外部設計書 06-4): 1920×1080 に収める。文字は28px以上。操作はなし。
//
// The design is a 1920×1080 canvas. It is scaled to fit any screen (1280×720 up to 4K)
// with CSS only, no script and no inline styles: the canvas is the largest 16:9 box that
// fits the viewport, and every size inside is written in canvas pixels through --u
// (1 canvas pixel = 1/1920 of the canvas width, a container query unit). Tailwind's
// spacing scale (p-6, gap-4, ...) is rebased on --u the same way. At 1920×1080 every
// size is exactly the design size, so text stays at 28px or more there.

export type MonitorClassRow = {
  className: string;
  /** 今日でないときだけ: 11/27(金) */
  dateText: string | null;
  /** 未定のときは null */
  periodLabel: string | null;
  subject: string;
  room: string;
};

export type MonitorRoomCard = {
  key: string;
  room: string;
  /** 授業のときのクラス名・科目・講師。予約のときは null(「予約使用中」とだけ出す) */
  lesson: { className: string; subject: string; teacher: string } | null;
};

// How many rows and cards fit in the canvas (one line each, see the truncate classes).
// 次の授業: 897px inside the panel, 56px for the heading, 60px per row -> 14 rows; one
// row is kept free as a margin. 使用中の教室: 889px below the heading, 186px per card
// row plus 16px gap -> 4 rows of 2 cards.
const MAX_CLASS_ROWS = 13;
const MAX_ROOM_CARDS = 8;

/** Fits a list into `max` places: when it is longer, the last place says 「ほかN件」. */
function fitList<T>(items: T[], max: number): { shown: T[]; hidden: number } {
  if (items.length <= max) return { shown: items, hidden: 0 };
  return { shown: items.slice(0, max - 1), hidden: items.length - (max - 1) };
}

export function MonitorView({
  todayText,
  timeText,
  updatedText,
  classes,
  rooms,
}: {
  todayText: string;
  timeText: string;
  updatedText: string;
  classes: MonitorClassRow[];
  rooms: MonitorRoomCard[];
}) {
  const classList = fitList(classes, MAX_CLASS_ROWS);
  const roomList = fitList(rooms, MAX_ROOM_CARDS);
  return (
    // The viewport (a size container), letterboxed in navy when it is not 16:9.
    <div className="fixed inset-0 grid place-items-center overflow-hidden bg-navy [container-type:size]">
      {/* The canvas: the largest 16:9 box that fits, and the container --u refers to. */}
      <div className="aspect-video w-[min(100cqw,calc(100cqh*16/9))] [container-type:inline-size]">
        <div className="flex h-full flex-col text-[length:calc(28*var(--u))] leading-tight text-white [--spacing:calc(4*var(--u))] [--u:calc(100cqw/1920)]">
          <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 px-10 py-6">
            <div className="text-[length:calc(44*var(--u))] font-bold tracking-wide">
              ミエルーム
            </div>
            <div className="text-[length:calc(40*var(--u))] font-bold">
              {todayText} {timeText}
            </div>
            <div className="text-right text-white/70">
              最終更新 {updatedText}
            </div>
          </header>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-6 px-10 pb-8">
            {/* self-start: the white panel ends after its last row instead of running empty to the bottom. */}
            <section className="max-h-full min-h-0 self-start overflow-hidden rounded-[calc(18*var(--u))] bg-white p-6 text-ink">
              <h2 className="mb-4 text-[length:calc(32*var(--u))] font-bold text-navy">
                次の授業
              </h2>
              <table className="w-full">
                <tbody>
                  {classList.shown.map((row) => (
                    <tr key={row.className} className="border-t border-line">
                      <td className="whitespace-nowrap py-3 pr-10 font-bold">
                        {row.className}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-10">
                        {row.dateText ? `${row.dateText} ` : ""}
                        {row.periodLabel ?? ""}
                      </td>
                      {/* w-full + max-w-0: takes the rest of the row and cuts a long
                          subject with …. pr-10 on the first two cells keeps the columns
                          apart (40 canvas px) on a hallway display. */}
                      <td className="w-full max-w-0 truncate py-3 pr-6">
                        {row.subject}
                      </td>
                      <td className="whitespace-nowrap py-3 text-right font-bold text-brand-dark">
                        {row.room}
                      </td>
                    </tr>
                  ))}
                  {classList.hidden > 0 && (
                    <tr className="border-t border-line">
                      <td colSpan={4} className="py-3 font-bold text-muted">
                        ほか{classList.hidden}件
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
            <section className="min-h-0 overflow-hidden">
              <h2 className="mb-4 text-[length:calc(32*var(--u))] font-bold">
                使用中の教室
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {roomList.shown.map((card) => (
                  <div
                    key={card.key}
                    className="min-w-0 rounded-[calc(14*var(--u))] bg-white p-4 text-ink"
                  >
                    <div className="truncate text-[length:calc(36*var(--u))] font-bold text-navy">
                      {card.room}
                    </div>
                    {card.lesson ? (
                      <>
                        <div className="mt-1 truncate font-semibold">
                          {card.lesson.className}
                        </div>
                        <div className="truncate">{card.lesson.subject}</div>
                        <div className="truncate text-muted">
                          {card.lesson.teacher}
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 font-semibold text-amber-ink">
                        予約使用中
                      </div>
                    )}
                  </div>
                ))}
                {roomList.hidden > 0 && (
                  <div className="grid place-items-center rounded-[calc(14*var(--u))] border-2 border-dashed border-white/60 p-4 font-bold">
                    ほか{roomList.hidden}件
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

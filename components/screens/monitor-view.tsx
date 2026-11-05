// S30 モニター (外部設計書 06-4): 1920×1080 に収める。文字は28px以上。操作はなし。

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
  return (
    <div className="flex h-[1080px] w-[1920px] flex-col bg-navy text-[28px] leading-tight text-white">
      <header className="flex items-center justify-between px-10 py-6">
        <div className="text-[44px] font-bold tracking-wide">ミエルーム</div>
        <div className="text-[40px] font-bold">
          {todayText} {timeText}
        </div>
        <div className="text-[28px] text-white/70">最終更新 {updatedText}</div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-6 px-10 pb-8">
        <section className="min-h-0 overflow-hidden rounded-[18px] bg-white p-6 text-ink">
          <h2 className="mb-4 text-[32px] font-bold text-navy">次の授業</h2>
          <table className="w-full">
            <tbody>
              {classes.map((row) => (
                <tr key={row.className} className="border-t border-line">
                  <td className="py-2 pr-4 font-bold">{row.className}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {row.dateText ? `${row.dateText} ` : ""}
                    {row.periodLabel ?? ""}
                  </td>
                  <td className="py-2 pr-4">{row.subject}</td>
                  <td className="py-2 text-right font-bold text-teal-dark">
                    {row.room}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="min-h-0 overflow-hidden">
          <h2 className="mb-4 text-[32px] font-bold">使用中の教室</h2>
          <div className="grid grid-cols-2 gap-4">
            {rooms.map((card) => (
              <div
                key={card.key}
                className="rounded-[14px] bg-white p-4 text-ink"
              >
                <div className="text-[36px] font-bold text-navy">
                  {card.room}
                </div>
                {card.lesson ? (
                  <>
                    <div className="mt-1 font-semibold">
                      {card.lesson.className}
                    </div>
                    <div>{card.lesson.subject}</div>
                    <div className="text-muted">{card.lesson.teacher}</div>
                  </>
                ) : (
                  <div className="mt-1 font-semibold text-amber-ink">
                    予約使用中
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

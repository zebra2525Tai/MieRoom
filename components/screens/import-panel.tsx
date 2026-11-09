"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Badge, Callout, TableWrap, Td, Th } from "@/components/ui/parts";
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_TOTAL_BYTES,
} from "@/lib/domain/import-limits";
import { MESSAGES } from "@/lib/messages";
import type {
  ApplyResult,
  ImportCheckView,
} from "@/lib/domain/timetable-import";

// S20 (2) 取り込み: choose files, 「確認する」, then 「取り込む」. The server checks again
// before it writes anything; what is shown here is only what the server answered.

const URL_CHECK = "/admin/import/check";
const URL_APPLY = "/admin/import/apply";

const VERDICT = {
  ok: { label: "OK", kind: "available" },
  warning: { label: "警告あり", kind: "warning" },
  error: { label: "エラー", kind: "error" },
} as const;

const LEVEL = {
  error: { label: "エラー", kind: "error" },
  warning: { label: "警告", kind: "warning" },
  info: { label: "お知らせ", kind: "neutral" },
} as const;

const monthText = (month: string | null) =>
  month === null
    ? "—"
    : `${Number(month.slice(0, 4))}年${Number(month.slice(5))}月`;

async function post(url: string, files: File[]): Promise<unknown> {
  const body = new FormData();
  for (const file of files) body.append("files", file);
  const response = await fetch(url, { method: "POST", body });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : MESSAGES.ME901;
    throw new Error(message);
  }
  return data;
}

function tooBig(files: File[]): boolean {
  return (
    files.length > MAX_FILES ||
    files.some((file) => file.size > MAX_FILE_BYTES) ||
    files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES
  );
}

export function ImportPanel() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [view, setView] = useState<ImportCheckView | null>(null);
  const [notice, setNotice] = useState<
    { kind: "error" | "info"; text: string }[]
  >([]);
  const [pending, startTransition] = useTransition();

  function choose(list: File[]) {
    setFiles(list);
    setView(null);
    setNotice(tooBig(list) ? [{ kind: "error", text: MESSAGES.ME418 }] : []);
  }

  function check(list: File[]) {
    if (list.length === 0 || tooBig(list)) return;
    startTransition(async () => {
      try {
        setView((await post(URL_CHECK, list)) as ImportCheckView);
        setNotice([]);
      } catch (error) {
        setNotice([{ kind: "error", text: (error as Error).message }]);
      }
    });
  }

  function apply() {
    if (view === null || !view.ok) return;
    const question =
      MESSAGES.MC401(files.length) +
      (view.lostChanges > 0 ? `\n${MESSAGES.MC701(view.lostChanges)}` : "");
    if (!window.confirm(question)) return;
    startTransition(async () => {
      try {
        const result = (await post(URL_APPLY, files)) as ApplyResult;
        if (result.kind === "invalid") {
          setView(result.view);
          return;
        }
        setNotice(
          result.summary.months.map((line) => ({
            kind: "info",
            text: MESSAGES.MI402(
              Number(line.month.slice(5)),
              line.classes,
              line.lessons,
            ),
          })),
        );
        setFiles([]);
        setView(null);
        if (input.current) input.current.value = "";
        router.refresh();
      } catch (error) {
        setNotice([{ kind: "error", text: (error as Error).message }]);
      }
    });
  }

  function remove(index: number) {
    const rest = files.filter((_, i) => i !== index);
    setFiles(rest);
    setView(null);
    if (rest.length === 0 && input.current) input.current.value = "";
    check(rest);
  }

  const step = view === null ? (files.length > 0 ? 1 : 0) : view.ok ? 2 : 1;
  return (
    <div>
      {/* 狭い画面では、ラベルを番号の下に置く(単語の途中で折り返さない) */}
      {/* 現在の段は塗りつぶし、済んだ段は薄い青。ドロップ枠の中央にそろえる */}
      <ol className="mx-auto mb-6 mt-2 flex max-w-[680px] items-start gap-3 text-xs sm:items-center">
        {["ファイルを選ぶ", "確認する", "取り込む"].map((label, index) => (
          <li key={label} className="contents">
            {index > 0 && (
              <div
                className={`mt-[13px] h-px min-w-6 flex-1 sm:mt-0 ${index <= step ? "bg-action" : "bg-[#d5dae6]"}`}
              />
            )}
            <div
              aria-current={index === step ? "step" : undefined}
              className={`flex flex-col items-center gap-1.5 whitespace-nowrap sm:flex-row sm:gap-2 ${
                index === step
                  ? "font-bold text-brand-dark"
                  : index < step
                    ? "text-brand-dark"
                    : "text-[#586579]"
              }`}
            >
              <span
                className={`grid h-[27px] w-[27px] place-items-center rounded-full text-[11px] font-bold ${
                  index === step
                    ? "bg-brand text-white"
                    : index < step
                      ? "bg-brand-tint text-brand-dark"
                      : "bg-[#edf0f5]"
                }`}
              >
                {index + 1}
              </span>
              {label}
            </div>
          </li>
        ))}
      </ol>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          choose(
            [...event.dataTransfer.files].filter((file) =>
              file.name.toLowerCase().endsWith(".csv"),
            ),
          );
        }}
        className="rounded-xl border-[1.5px] border-dashed border-[#8a96ad] bg-[#f6f8fc] px-4 py-8 text-center sm:px-6 sm:py-10"
      >
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[14px] bg-[#e8ecff] text-[#4a576c]">
          <Icon name="upload" size={27} />
        </div>
        <h2 className="text-[17px] font-bold">取込用CSVを選ぶ</h2>
        <p className="mb-4 mt-2 text-xs text-muted">
          {/* 上限の数字が行の途中で切れないよう、区切りごとにまとめる */}
          複数まとめて選べます
          <span className="inline-block">(1回50ファイル、</span>
          <span className="inline-block">1ファイル1MB、</span>
          <span className="inline-block">合計4MBまで)。</span>
          ここにドラッグしてもかまいません。
          <br />
          エラーが1つでもあると、何も取り込みません。
        </p>
        {/* ネイティブの入力は見えなくして、ボタンの形のラベルから開く(キーボードでも入力にフォーカスが届く) */}
        <div className="mx-auto flex max-w-xs flex-col items-stretch gap-2 sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
          <input
            ref={input}
            id={inputId}
            type="file"
            accept=".csv"
            multiple
            className="peer sr-only"
            onChange={(event) => choose([...(event.currentTarget.files ?? [])])}
          />
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-white px-3.5 py-2.5 text-xs font-semibold leading-normal text-ink transition-colors hover:border-[#8a96ad] hover:bg-[#f6f8fc] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-[#4b6bff]"
          >
            <Icon name="file" size={15} />
            ファイルを選ぶ
          </label>
          <Button
            variant="primary"
            disabled={pending || files.length === 0 || tooBig(files)}
            onClick={() => check(files)}
          >
            確認する
            <Icon name="arrow" size={15} />
          </Button>
        </div>
        <p className="mx-auto mt-3 max-w-xl text-[11px] text-muted">
          {files.length === 0 ? (
            "ファイルが選ばれていません"
          ) : (
            <>
              <span className="font-semibold text-ink">
                {files.length}件を選んでいます
              </span>
              <span className="mt-0.5 line-clamp-2 break-all">
                {files.map((file) => file.name).join("、")}
              </span>
            </>
          )}
        </p>
      </div>

      <div aria-live="polite" className="mt-5">
        {notice.map((item) => (
          <Callout
            key={item.text}
            kind={item.kind === "error" ? "error" : "info"}
          >
            {item.text}
          </Callout>
        ))}
        {pending && <p className="text-xs text-muted">処理しています…</p>}

        {view !== null && (
          <>
            {view.general.map((issue) => (
              <Callout key={issue.message} kind="error">
                {issue.message}
              </Callout>
            ))}
            <TableWrap>
              <thead>
                <tr>
                  <Th>ファイル</Th>
                  <Th>クラス</Th>
                  <Th>対象月</Th>
                  <Th>授業</Th>
                  <Th>休み・行事</Th>
                  <Th>判定</Th>
                  <Th>メッセージ</Th>
                  <Th>
                    <span className="sr-only">操作</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {view.files.map((file, index) => (
                  <tr key={`${file.name}-${index}`}>
                    <Td className="min-w-[260px] whitespace-normal break-all">
                      {file.name}
                    </Td>
                    <Td>{file.className ?? "—"}</Td>
                    <Td>{monthText(file.month)}</Td>
                    <Td>{file.lessonCount}</Td>
                    <Td>{file.closureCount}</Td>
                    <Td>
                      <Badge kind={VERDICT[file.verdict].kind}>
                        {VERDICT[file.verdict].label}
                      </Badge>
                    </Td>
                    <Td className="min-w-[280px] whitespace-normal">
                      {file.issues.length === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {file.issues.map((issue, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Badge kind={LEVEL[issue.level].kind}>
                                {LEVEL[issue.level].label}
                              </Badge>
                              <span>
                                {issue.code} {issue.message}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => remove(index)}
                      >
                        外す
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                disabled={pending || !view.ok}
                onClick={apply}
              >
                <Icon name="upload" size={16} />
                取り込む
              </Button>
              <span className="text-[11px] text-muted">
                {view.ok
                  ? "エラーはありません。取り込むと、同じクラス・同じ月の時間割は入れ替わります。"
                  : "エラーがあるため、取り込めません。直して選び直すか、エラーのファイルを外してください。"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** 例外解除 (R3-5, MC402): the class can import its month once, after the closing day. */
export function UnlockButton({
  classId,
  className,
  month,
}: {
  classId: string;
  className: string;
  month: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(MESSAGES.MC402(className, Number(month.slice(5))))
          ) {
            return;
          }
          startTransition(async () => {
            const body = new FormData();
            body.set("classId", classId);
            body.set("month", month);
            const response = await fetch("/admin/import/unlock", {
              method: "POST",
              body,
            });
            if (response.ok) router.refresh();
            else setFailed(true);
          });
        }}
      >
        例外解除
      </Button>
      {failed && (
        <span role="alert" className="text-[11px] text-red-ink">
          {MESSAGES.ME901}
        </span>
      )}
    </>
  );
}

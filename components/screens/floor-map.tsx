import {
  FLOORS,
  SCALE,
  type Floor,
  type PlanRoom,
  type Pt,
  type RoomState,
  type RoomStates,
} from "@/lib/domain/floor-plan";
import {
  boundsOf,
  centroid,
  FONT,
  lessonLayout,
} from "@/lib/domain/floor-text";

// S30 モニターのフロアマップ: 6階分を 1920×950 に並べる (3列×2行)。教室の位置は図で決まり、
// 色と文字は、教室ごとの状態 (授業中・次の授業・予約使用中・空き・使用止め) で決まる。
// 操作はなく、サーバーで描ける (クライアントのコードはいらない)。

export const MAP_WIDTH = 1920;
export const MAP_HEIGHT = 950;
const PANEL_W = 600;
const PANEL_H = 470;
const COLS = [35, 660, 1285];
const ROWS = [0, 480];
const MAP_X = 5; // パネルの中の図の左上
const MAP_Y = 62;

const HATCH = "monitor-hatch";

const COLORS = {
  next: { fill: "#e3edff", stroke: "#2f6fe4", text: "#1b4fb0", sub: "#34568c" },
  lesson: {
    fill: "#2f6fe4",
    stroke: "#1b4fb0",
    text: "#ffffff",
    sub: "#eef4ff",
  },
  reserved: {
    fill: "#f6b73c",
    stroke: "#c98a0c",
    text: "#3a2a00",
    sub: "#3a2a00",
  },
  free: { fill: "#d7f2de", stroke: "#2e9e57", text: "#15602f", sub: "#15602f" },
  blocked: {
    fill: `url(#${HATCH})`,
    stroke: "#7b8088",
    text: "#4a4f57",
    sub: "#4a4f57",
  },
  unknown: {
    fill: "#eceff3",
    stroke: "#b8c0cc",
    text: "#7b8798",
    sub: "#7b8798",
  },
};
const FACILITY = { fill: "#e9edf3", stroke: "#a8b3c4", text: "#5b6678" };
const OFFICE = { fill: "#e6dcf3", stroke: "#a58cc9", text: "#5a4380" };
const GREEN = { fill: "#d9f0e0", stroke: "#8fcba3", text: "#3d6f50" };
const EMERGENCY = { fill: "#fbe3e3", stroke: "#d46a6a", text: "#a12b2b" };
const OPEN = { fill: "none", stroke: "#c6d0de", text: "#7b8798" };
const TOILET = {
  m: { fill: "#dcebff", stroke: "#4b86d6", ink: "#1f62c4" },
  f: { fill: "#ffe1e1", stroke: "#d9605f", ink: "#c0392b" },
  a: { fill: "#daf3e3", stroke: "#4aa36d", ink: "#1b7f4b" },
};

const scaled = (points: readonly Pt[]): Pt[] =>
  points.map(([x, y]) => [x * SCALE, y * SCALE] as const);
const pointsText = (points: readonly Pt[]) =>
  points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

function Text({
  x,
  y,
  size,
  fill,
  bold,
  children,
}: {
  x: number;
  y: number;
  size: number;
  fill: string;
  bold?: boolean;
  children: string;
}) {
  return (
    <text
      x={x.toFixed(1)}
      y={y.toFixed(1)}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={size}
      fontWeight={bold ? 700 : 400}
      fill={fill}
    >
      {children}
    </text>
  );
}

function Toilet({ room }: { room: PlanRoom }) {
  const style = TOILET[room.gender ?? "m"];
  const points = scaled(room.points);
  const [cx, cy] = centroid(points);
  const k = 1.2;
  const x = cx;
  const y = cy + 3;
  const at = (dx: number, dy: number) =>
    `${(x + dx * k).toFixed(1)},${(y + dy * k).toFixed(1)}`;
  return (
    <>
      <polygon
        points={pointsText(points)}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={2}
      />
      <circle cx={x} cy={y - 14 * k} r={6.5 * k} fill={style.ink} />
      {room.gender === "m" && (
        <rect
          x={x - 7 * k}
          y={y - 5 * k}
          width={14 * k}
          height={19 * k}
          rx={4 * k}
          fill={style.ink}
        />
      )}
      {room.gender === "f" && (
        <polygon
          points={`${at(0, -6)} ${at(10, 14)} ${at(-10, 14)}`}
          fill={style.ink}
        />
      )}
      {room.gender === "a" && (
        <>
          <polyline
            points={`${at(-2, -7)} ${at(-2, 4)} ${at(8, 4)} ${at(11, 13)}`}
            fill="none"
            stroke={style.ink}
            strokeWidth={3 * k}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={x - 3 * k}
            cy={y + 9 * k}
            r={8 * k}
            fill="none"
            stroke={style.ink}
            strokeWidth={2.6 * k}
          />
        </>
      )}
    </>
  );
}

function StatusRoom({
  room,
  state,
}: {
  room: PlanRoom;
  state: RoomState | undefined;
}) {
  const points = scaled(room.points);
  const [cx, cy] = centroid(points);
  const key =
    state === undefined
      ? "unknown"
      : state.kind === "lesson" && state.next
        ? "next"
        : state.kind;
  const style = COLORS[key];
  const isNext = key === "next";
  const bounds = boundsOf(points);

  if (state?.kind === "lesson") {
    const layout = lessonLayout(points, [cx, cy], room.name, state);
    return (
      <>
        <polygon
          points={pointsText(points)}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth={isNext ? 3 : 2.5}
          strokeDasharray={isNext ? "9 5" : undefined}
        />
        {isNext && (
          <>
            <rect
              x={bounds.x1 - 40}
              y={bounds.y0 + 6}
              width={34}
              height={24}
              rx={12}
              fill="#2f6fe4"
            />
            <Text
              x={bounds.x1 - 23}
              y={bounds.y0 + 18}
              size={16}
              fill="#fff"
              bold
            >
              次
            </Text>
          </>
        )}
        {layout.lines.map((line, i) => (
          <Text
            key={i}
            x={layout.x}
            y={line.y}
            size={line.size}
            bold={line.bold}
            fill={line.tone === "main" ? style.text : style.sub}
          >
            {line.text}
          </Text>
        ))}
      </>
    );
  }

  const label =
    state === undefined
      ? ""
      : state.kind === "free"
        ? "空き"
        : state.kind === "reserved"
          ? "予約使用中"
          : "使用止め";
  return (
    <>
      <polygon
        points={pointsText(points)}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={2.5}
      />
      <Text
        x={cx}
        y={cy - (label ? 14 : 0)}
        size={FONT.num}
        fill={style.text}
        bold
      >
        {room.name}
      </Text>
      {label && (
        <Text x={cx} y={cy + 14} size={FONT.state} fill={style.sub} bold>
          {label}
        </Text>
      )}
    </>
  );
}

function PlainRoom({ room }: { room: PlanRoom }) {
  const style =
    room.kind === "office"
      ? OFFICE
      : room.kind === "green"
        ? GREEN
        : room.kind === "emerg"
          ? EMERGENCY
          : room.kind === "open"
            ? OPEN
            : FACILITY;
  const points = scaled(room.points);
  const [cx0, cy0] = centroid(points);
  const [cx, cy] = room.labelAt
    ? [room.labelAt[0] * SCALE, room.labelAt[1] * SCALE]
    : [cx0, cy0];
  const size = room.small ? FONT.small : FONT.name;
  return (
    <>
      <polygon
        points={pointsText(points)}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={1.5}
        strokeDasharray={room.kind === "open" ? "6 5" : undefined}
      />
      {room.name !== "" &&
        (room.vertical ? (
          <text
            transform={`translate(${cx.toFixed(1)},${cy.toFixed(1)}) rotate(90)`}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={room.kind === "emerg" ? 15 : 13}
            fontWeight={700}
            fill={style.text}
          >
            {room.name}
          </text>
        ) : (
          <Text x={cx} y={cy} size={size} fill={style.text} bold>
            {room.name}
          </Text>
        ))}
    </>
  );
}

function FloorPanel({
  floor,
  index,
  states,
}: {
  floor: Floor;
  index: number;
  states: RoomStates;
}) {
  const px = COLS[index % 3];
  const py = ROWS[Math.floor(index / 3)];
  const outline = pointsText(scaled(floor.outline));
  const clip = `monitor-clip-${floor.id}`;
  return (
    <g transform={`translate(${px},${py})`}>
      <rect width={PANEL_W} height={PANEL_H} rx={18} fill="#f4f7fb" />
      <rect x={14} y={10} width={62} height={40} rx={10} fill={floor.color} />
      <text
        x={45}
        y={31}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={28}
        fontWeight={800}
        fill="#fff"
      >
        {floor.id}
      </text>
      <text
        x={88}
        y={31}
        dominantBaseline="central"
        fontSize={22}
        fontWeight={700}
        fill="#1b2a41"
      >
        {floor.title}
      </text>
      <g transform={`translate(${MAP_X},${MAP_Y})`}>
        <clipPath id={clip}>
          <polygon points={outline} />
        </clipPath>
        {/* 床(通路)→ 部屋(外枠の内側だけ)→ 外枠(いちばん上)の順 */}
        <polygon points={outline} fill="#fff6dc" />
        <g clipPath={`url(#${clip})`}>
          {floor.rooms.map((room, i) => {
            if (room.kind === "room") {
              return (
                <StatusRoom key={i} room={room} state={states[room.name]} />
              );
            }
            if (room.kind === "wc") return <Toilet key={i} room={room} />;
            return <PlainRoom key={i} room={room} />;
          })}
        </g>
        <polygon
          points={outline}
          fill="none"
          stroke="#5f6f8a"
          strokeWidth={7}
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

export function FloorMap({ states }: { states: RoomStates }) {
  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      className="h-full w-full"
      role="img"
      aria-label="教室の使用状況のフロアマップ"
    >
      <defs>
        <pattern
          id={HATCH}
          width={12}
          height={12}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={12} height={12} fill="#dcdee3" />
          <rect width={6} height={12} fill="#b9bdc5" />
        </pattern>
      </defs>
      {FLOORS.map((floor, index) => (
        <FloorPanel
          key={floor.id}
          floor={floor}
          index={index}
          states={states}
        />
      ))}
    </svg>
  );
}

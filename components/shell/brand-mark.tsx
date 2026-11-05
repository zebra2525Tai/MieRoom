// The app icon (app/icon.svg, small version) as a component, for the sidebar and
// the sign-in screen. Written inline instead of an <img> so that it needs no request
// (the sign-in screen must not depend on files behind the login redirect).
export function BrandMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-[38px] w-[38px] shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="mieroom-mark-gDb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4B6BFF" />
          <stop offset="1" stopColor="#1E36D6" />
        </linearGradient>
        <linearGradient id="mieroom-mark-gTb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fa3ff" />
          <stop offset="1" stopColor="#7482e6" />
        </linearGradient>
        <linearGradient id="mieroom-mark-gLb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#dde1f9" />
        </linearGradient>
        <linearGradient id="mieroom-mark-gMb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#aab3ef" />
          <stop offset="1" stopColor="#8e9aea" />
        </linearGradient>
        <linearGradient id="mieroom-mark-gAb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE27A" />
          <stop offset="1" stopColor="#FFC21A" />
        </linearGradient>
        <linearGradient id="mieroom-mark-gRb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF6B6B" />
          <stop offset="1" stopColor="#D62839" />
        </linearGradient>
        <filter
          id="mieroom-mark-psb"
          x="-30%"
          y="-30%"
          width="170%"
          height="170%"
        >
          <feDropShadow
            dx="0"
            dy="1.6"
            stdDeviation="1.3"
            floodColor="#5a0010"
            floodOpacity=".45"
          />
        </filter>
        <radialGradient id="mieroom-mark-glb" cx=".5" cy=".42" r=".72">
          <stop offset="0" stopColor="#FFE27A" stopOpacity=".95" />
          <stop offset="1" stopColor="#FFE27A" stopOpacity=".12" />
        </radialGradient>
        <filter
          id="mieroom-mark-fbb"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feGaussianBlur stdDeviation="0.15" />
        </filter>
        <filter
          id="mieroom-mark-shb"
          x="-25%"
          y="-25%"
          width="150%"
          height="165%"
        >
          <feDropShadow
            dx="0"
            dy="1.6"
            stdDeviation="1.4"
            floodColor="#000"
            floodOpacity=".26"
          />
        </filter>
      </defs>
      <g filter="url(#mieroom-mark-shb)">
        <g transform="translate(32 32) scale(1.0) translate(-33.5 -31.5)">
          <rect
            x="40"
            y="20"
            width="20"
            height="42"
            rx="4.6"
            fill="url(#mieroom-mark-gDb)"
            fillOpacity=".72"
          />
          <rect
            x="4"
            y="20"
            width="40"
            height="42"
            rx="4.6"
            fill="url(#mieroom-mark-gDb)"
            stroke="rgba(255,255,255,.34)"
            strokeWidth=".8"
          />
          <rect
            x="9"
            y="25"
            width="30"
            height="32"
            rx="4.2"
            fill="#fff"
            fillOpacity=".8"
          />
          <rect
            x="9"
            y="25"
            width="30"
            height="32"
            rx="4.2"
            fill="url(#mieroom-mark-glb)"
          />
          <g filter="url(#mieroom-mark-fbb)">
            <circle
              cx="24"
              cy="31.40"
              r="5.40"
              fill="#12238F"
              fillOpacity="0.95"
            />
            <path
              d="M12.00 56.00Q12.00 40.00 24 40.00Q36.00 40.00 36.00 56.00Z"
              fill="#12238F"
              fillOpacity="0.95"
            />
          </g>
          <g filter="url(#mieroom-mark-psb)">
            <g transform="translate(37 -1.5) scale(1.3)">
              <path
                d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"
                fill="url(#mieroom-mark-gRb)"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="0.7"
              />
              <circle cx="12" cy="10" r="3.1" fill="#fff" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

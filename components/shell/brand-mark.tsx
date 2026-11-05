// The app icon as a component, for the sidebar and the sign-in screen.
// Written inline instead of an <img> so that it needs no request (the sign-in screen
// must not depend on files behind the login redirect).
// "plain" has no background (app/icon.svg); "tile" sits on a rounded cobalt square
// (brand/mieroom-icon-tile.svg). Same drawing, so they can be swapped anywhere.
export function BrandMark({
  variant = "plain",
}: {
  variant?: "plain" | "tile";
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-[38px] w-[38px] shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      {variant === "tile" ? (
        <>
          <defs>
            <linearGradient id="mieroom-tile-bgc" x1="0" y1="0" x2=".3" y2="1">
              <stop offset="0" stopColor="#4B6BFF" />
              <stop offset="1" stopColor="#1E36D6" />
            </linearGradient>
            <radialGradient id="mieroom-tile-gwc" cx=".22" cy=".12" r=".75">
              <stop offset="0" stopColor="#fff" stopOpacity=".2" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <clipPath id="mieroom-tile-cpp">
              <rect x="9.5" y="19.4" width="24.5" height="37.6" rx="3.8" />
            </clipPath>
            <clipPath id="mieroom-tile-cpc">
              <rect width="64" height="64" rx="15" />
            </clipPath>
            <linearGradient id="mieroom-tile-gRd" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7D94FF" />
              <stop offset="1" stopColor="#5D6EE1" />
            </linearGradient>
            <linearGradient id="mieroom-tile-gDa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4B6BFF" />
              <stop offset="1" stopColor="#1E36D6" />
            </linearGradient>
            <linearGradient id="mieroom-tile-gTa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8fa3ff" />
              <stop offset="1" stopColor="#7482e6" />
            </linearGradient>
            <radialGradient id="mieroom-tile-gwa" cx=".22" cy=".12" r=".75">
              <stop offset="0" stopColor="#fff" stopOpacity=".2" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="mieroom-tile-gLa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#dde1f9" />
            </linearGradient>
            <linearGradient id="mieroom-tile-gMa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#aab3ef" />
              <stop offset="1" stopColor="#8e9aea" />
            </linearGradient>
            <linearGradient id="mieroom-tile-gAa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFE27A" />
              <stop offset="1" stopColor="#FFC21A" />
            </linearGradient>
            <linearGradient id="mieroom-tile-gRa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FF6B6B" />
              <stop offset="1" stopColor="#D62839" />
            </linearGradient>
            <filter
              id="mieroom-tile-psa"
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
            <radialGradient id="mieroom-tile-gla" cx=".5" cy=".42" r=".72">
              <stop offset="0" stopColor="#FFE27A" stopOpacity=".95" />
              <stop offset="1" stopColor="#FFE27A" stopOpacity=".12" />
            </radialGradient>
            <filter
              id="mieroom-tile-fba"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="0.2" />
            </filter>
            <filter
              id="mieroom-tile-sha"
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
          <g clipPath="url(#mieroom-tile-cpc)">
            <rect width="64" height="64" fill="url(#mieroom-tile-bgc)" />
            <rect width="64" height="64" fill="url(#mieroom-tile-gwc)" />
            <g filter="url(#mieroom-tile-sha)">
              <g transform="translate(32 32) scale(.86) translate(-33.75 -32.6)">
                <rect
                  x="35"
                  y="14"
                  width="27"
                  height="48"
                  rx="3.8"
                  fill="url(#mieroom-tile-gLa)"
                  fillOpacity=".78"
                />
                <rect
                  x="4"
                  y="14"
                  width="34"
                  height="48"
                  rx="3.8"
                  fill="url(#mieroom-tile-gLa)"
                  stroke="rgba(255,255,255,.34)"
                  strokeWidth=".8"
                />
                <rect
                  x="9.5"
                  y="19.4"
                  width="24.5"
                  height="37.6"
                  rx="3.8"
                  fill="#fff"
                />
                <rect
                  x="9.5"
                  y="19.4"
                  width="24.5"
                  height="37.6"
                  rx="3.8"
                  fill="url(#mieroom-tile-gla)"
                />
                <g clipPath="url(#mieroom-tile-cpp)">
                  <g
                    filter="url(#mieroom-tile-fba)"
                    transform="translate(0 -0.9) translate(21.7 55.4) scale(1.18) translate(-21.7 -55.4)"
                  >
                    <circle
                      cx="21.7"
                      cy="34.24"
                      r="4.64"
                      fill="#12238F"
                      fillOpacity="0.95"
                    />
                    <path
                      d="M11.38 55.40Q11.38 41.64 21.7 41.64Q32.02 41.64 32.02 55.40Z"
                      fill="#12238F"
                      fillOpacity="0.95"
                    />
                  </g>
                </g>
                <rect
                  x="42"
                  y="33"
                  width="3.2"
                  height="12"
                  rx="1.6"
                  fill="#12238F"
                  fillOpacity=".5"
                />
                <g filter="url(#mieroom-tile-psa)">
                  <g transform="translate(35 -1.75) scale(1.25)">
                    <path
                      d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"
                      fill="url(#mieroom-tile-gRa)"
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="0.7"
                    />
                    <circle cx="12" cy="10" r="3.1" fill="#fff" />
                  </g>
                </g>
              </g>
            </g>
          </g>
          <rect
            x=".6"
            y=".6"
            width="62.8"
            height="62.8"
            rx="14.4"
            fill="none"
            stroke="rgba(255,255,255,.12)"
            strokeWidth="1.2"
          />
        </>
      ) : (
        <>
          <defs>
            <linearGradient id="mieroom-plain-gRd" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7D94FF" />
              <stop offset="1" stopColor="#5D6EE1" />
            </linearGradient>
            <linearGradient id="mieroom-plain-gDa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4B6BFF" />
              <stop offset="1" stopColor="#1E36D6" />
            </linearGradient>
            <linearGradient id="mieroom-plain-gTa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8fa3ff" />
              <stop offset="1" stopColor="#7482e6" />
            </linearGradient>
            <radialGradient id="mieroom-plain-gwa" cx=".22" cy=".12" r=".75">
              <stop offset="0" stopColor="#fff" stopOpacity=".2" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="mieroom-plain-gLa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#dde1f9" />
            </linearGradient>
            <linearGradient id="mieroom-plain-gMa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#aab3ef" />
              <stop offset="1" stopColor="#8e9aea" />
            </linearGradient>
            <linearGradient id="mieroom-plain-gAa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFE27A" />
              <stop offset="1" stopColor="#FFC21A" />
            </linearGradient>
            <linearGradient id="mieroom-plain-gRa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FF6B6B" />
              <stop offset="1" stopColor="#D62839" />
            </linearGradient>
            <filter
              id="mieroom-plain-psa"
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
            <radialGradient id="mieroom-plain-gla" cx=".5" cy=".42" r=".72">
              <stop offset="0" stopColor="#FFE27A" stopOpacity=".95" />
              <stop offset="1" stopColor="#FFE27A" stopOpacity=".12" />
            </radialGradient>
            <filter
              id="mieroom-plain-fba"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="0.2" />
            </filter>
            <filter
              id="mieroom-plain-sha"
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
          <g filter="url(#mieroom-plain-sha)">
            <g transform="translate(32 32) scale(1.0) translate(-33.75 -32.6)">
              <rect
                x="35"
                y="14"
                width="27"
                height="48"
                rx="3.8"
                fill="url(#mieroom-plain-gRd)"
              />
              <rect
                x="4"
                y="14"
                width="34"
                height="48"
                rx="3.8"
                fill="url(#mieroom-plain-gDa)"
                stroke="rgba(255,255,255,.34)"
                strokeWidth=".8"
              />
              <rect
                x="9.5"
                y="19.4"
                width="24.5"
                height="37.6"
                rx="3.8"
                fill="#fff"
              />
              <rect
                x="9.5"
                y="19.4"
                width="24.5"
                height="37.6"
                rx="3.8"
                fill="url(#mieroom-plain-gla)"
              />
              <g
                filter="url(#mieroom-plain-fba)"
                transform="translate(21.7 55.4) scale(1.12) translate(-21.7 -55.4) translate(0 -2)"
              >
                <circle
                  cx="21.7"
                  cy="34.24"
                  r="4.64"
                  fill="#12238F"
                  fillOpacity="0.95"
                />
                <path
                  d="M11.38 55.40Q11.38 41.64 21.7 41.64Q32.02 41.64 32.02 55.40Z"
                  fill="#12238F"
                  fillOpacity="0.95"
                />
              </g>
              <rect
                x="42"
                y="33"
                width="3.2"
                height="12"
                rx="1.6"
                fill="#fff"
                fillOpacity=".85"
              />
              <g filter="url(#mieroom-plain-psa)">
                <g transform="translate(35 -1.75) scale(1.25)">
                  <path
                    d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"
                    fill="url(#mieroom-plain-gRa)"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="0.7"
                  />
                  <circle cx="12" cy="10" r="3.1" fill="#fff" />
                </g>
              </g>
            </g>
          </g>
        </>
      )}
    </svg>
  );
}

import React from "react";

export function LoginHero() {
  return (
    <div className="relative hidden lg:flex items-center justify-center overflow-hidden bg-[#F4F6F4] dark:bg-[#07111E] p-8 xl:p-12 select-none border-l border-slate-200/80 dark:border-slate-800">
      {/* Background ambient lighting & soft glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-primary/10 dark:bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] bg-sky-500/10 dark:bg-sky-500/5 rounded-full blur-3xl" />
      </div>

      {/* Responsive SVG Artwork Container */}
      <div className="relative z-10 w-full max-w-md xl:max-w-xl 2xl:max-w-2xl flex items-center justify-center drop-shadow-xl transition-all duration-300">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 784 650"
          className="w-full h-auto max-h-[82vh] object-contain"
          fill="none"
          role="img"
          aria-labelledby="plantation-title plantation-desc"
        >
          <title id="plantation-title">Plantation Water Management</title>
          <desc id="plantation-desc">
            Pohon sawit dengan sistem pengairan, tetesan air, roda gigi, dan grafik pertumbuhan.
          </desc>

          <defs>
            <linearGradient
              id="pw-leaf"
              x1="220"
              y1="120"
              x2="550"
              y2="365"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#72A447" />
              <stop offset="1" stopColor="#3C762E" />
            </linearGradient>

            <linearGradient
              id="pw-water"
              x1="280"
              y1="400"
              x2="530"
              y2="625"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#48C6E7" />
              <stop offset="1" stopColor="#159DCB" />
            </linearGradient>

            <linearGradient
              id="pw-drop"
              x1="370"
              y1="365"
              x2="440"
              y2="495"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#50C8E7" />
              <stop offset="1" stopColor="#20ACD6" />
            </linearGradient>

            <clipPath id="pw-basin">
              <path d="M153 423 C172 540 280 623 410 623 C548 623 658 542 671 423 Z" />
            </clipPath>

            {/* Roda gigi reusable; ukuran dasar sekitar 58 × 58 */}
            <g id="pw-gear" fill="currentColor">
              <path d="M-7-29 H7 L9-22 L14-20 L21-23 L29-15 L25-9 L27-4 L34-2 V10 L27 12 L25 17 L28 23 L20 31 L14 27 L9 29 L7 36 H-7 L-9 29 L-14 27 L-21 31 L-29 23 L-25 17 L-27 12 L-34 10 V-2 L-27-4 L-25-9 L-29-15 L-21-23 L-14-20 L-9-22 Z" />
              <circle cy="3.5" r="13" fill="#FFF" />
            </g>

            <g id="pw-check">
              <circle r="25" fill="#F18B31" stroke="#FFF" strokeWidth="7" />
              <path
                d="M-11 0 L-3 8 L12-9"
                stroke="#FFF"
                strokeWidth="7"
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
            </g>
          </defs>

          {/* Lingkar luar */}
          <path
            d="M212 186 C177 230 156 279 151 333 M152 405 C166 529 275 623 410 623 C557 623 674 513 674 375 C674 296 651 231 608 179"
            stroke="#245D37"
            strokeWidth="11"
          />

          {/* Air dan area hijau bawah */}
          <g clipPath="url(#pw-basin)">
            <path d="M142 422 H682 V641 H142Z" fill="#679C42" />

            <path
              d="M252 421 C201 466 207 552 293 605 C388 665 560 618 627 553 L679 422 H465 V489 C440 522 381 517 357 477 V431 Z"
              fill="url(#pw-water)"
            />

            <path
              d="M464 423 H680 V459 H460"
              fill="#23AED4"
              stroke="#FFF"
              strokeWidth="9"
            />

            <path
              d="M242 445 C221 502 246 566 294 603"
              stroke="#E9F9F8"
              strokeWidth="11"
            />

            <path
              d="M285 493 C286 536 309 579 338 608"
              stroke="#E9F9F8"
              strokeWidth="10"
            />

            <path
              d="M309 516 C335 577 400 613 462 614 C401 595 352 563 309 516"
              fill="#138FBC"
              opacity={0.65}
            />

            <path
              d="M246 487 C232 507 236 527 249 541 C242 521 251 507 246 487"
              fill="#148EB9"
              opacity={0.65}
            />

            <path
              d="M365 570 C428 601 510 596 564 565 C512 608 421 612 365 570"
              fill="#EFFBF9"
            />
          </g>

          {/* Daun sawit */}
          <g fill="url(#pw-leaf)">
            {/* Daun tengah */}
            <path d="M408 354 C386 264 387 181 367 122 L392 148 L374 95 L397 119 C399 93 404 77 411 65 C421 80 425 95 425 116 L448 94 L430 145 L455 120 C431 177 420 264 417 353 Z" />

            {/* Daun kiri atas */}
            <path d="M405 327 C389 218 330 129 256 112 C328 100 382 138 408 222 L414 326 Z M273 119 L302 132 L265 142 L326 152 L280 161 L350 177 L305 186 L373 202 L333 211 L390 228 L351 236 L401 257 L371 266 L409 287 Z" />

            {/* Daun kanan atas */}
            <path d="M416 327 C433 218 492 129 566 112 C494 100 440 138 414 222 L408 326 Z M549 119 L520 132 L557 142 L496 152 L542 161 L472 177 L517 186 L449 202 L489 211 L432 228 L471 236 L421 257 L451 266 L413 287 Z" />

            {/* Daun kiri tengah */}
            <path d="M400 348 C353 230 285 191 199 224 C230 186 291 188 334 213 C378 239 399 283 411 333 Z M211 216 L270 217 L244 247 L292 226 L267 258 L316 237 L291 269 L342 250 L319 279 L363 269 L345 291 L385 294 L374 314 L402 332 Z" />

            {/* Daun kanan tengah */}
            <path d="M422 348 C469 230 537 191 623 224 C592 186 531 188 488 213 C444 239 423 283 411 333 Z M611 216 L552 217 L578 247 L530 226 L555 258 L506 237 L531 269 L480 250 L503 279 L459 269 L477 291 L437 294 L448 314 L420 332 Z" />

            {/* Daun kiri bawah */}
            <path d="M397 389 C363 286 274 244 191 332 C208 288 250 267 293 273 C350 280 388 319 406 374 Z M204 320 L245 300 L233 330 L271 296 L263 330 L294 298 L289 331 L318 304 L320 335 L343 318 L350 344 L368 339 L384 373 Z" />

            {/* Daun kanan bawah */}
            <path d="M425 389 C459 286 548 244 631 310 L615 331 C559 285 487 286 416 374 Z M618 314 L577 300 L589 330 L551 296 L559 330 L528 298 L533 331 L504 304 L502 335 L479 318 L472 344 L454 339 L438 373 Z" />
          </g>

          {/* Tulang daun dan batang */}
          <g stroke="#225E35" strokeWidth="10" strokeLinecap="round">
            <path d="M411 344 C405 239 361 144 275 116" />
            <path d="M411 344 C417 239 461 144 547 116" />
            <path d="M405 345 C362 238 289 178 211 219" />
            <path d="M417 345 C460 238 533 178 611 219" />
            <path d="M399 374 C364 291 279 238 202 321" />
            <path d="M423 374 C458 291 543 238 615 311" />
          </g>
          <path d="M411 127 L411 376" stroke="#2D6733" strokeWidth="12" />

          {/* Grafik batang */}
          <g fill="#6CA349" stroke="#FFF" strokeWidth="4">
            <path d="M508 369 H529 V415 H508Z" />
            <path d="M536 348 H557 V415 H536Z" />
            <path d="M564 369 H585 V415 H564Z" />
            <path d="M592 343 H613 V415 H592Z" />
            <path d="M620 320 H641 V415 H620Z" />
          </g>

          {/* Grafik garis */}
          <path
            d="M478 389 L542 334 L575 361 L663 282"
            stroke="#FFF"
            strokeWidth="22"
            strokeLinejoin="miter"
          />
          <path
            d="M478 389 L542 334 L575 361 L663 282"
            stroke="#193E50"
            strokeWidth="12"
            strokeLinejoin="miter"
          />
          <g fill="#193E50">
            <circle cx="478" cy="389" r="17" />
            <circle cx="663" cy="282" r="17" />
          </g>

          {/* Jaringan sensor */}
          <path
            d="M246 423 L286 353 L345 403"
            stroke="#193E50"
            strokeWidth="10"
            strokeLinejoin="round"
          />
          <circle cx="286" cy="353" r="15" fill="#193E50" />
          <circle cx="286" cy="353" r="8" fill="#F18B31" />
          <circle cx="345" cy="403" r="15" fill="#193E50" />
          <circle cx="345" cy="403" r="8" fill="#F18B31" />
          <circle
            cx="246"
            cy="423"
            r="16"
            fill="#F18B31"
            stroke="#FFF"
            strokeWidth="7"
          />

          {/* Pipa bawah */}
          <path
            d="M411 493 V550 H441 Q462 550 462 529 V529 Q462 513 478 513 H543 V464"
            stroke="#F3FCF8"
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M411 493 V550 H441 Q462 550 462 529 V529 Q462 513 478 513 H543 V464"
            stroke="#32B9DA"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d="M485 463 V508 M512 463 V508 M564 463 V515 H608"
            stroke="#F3FCF8"
            strokeWidth="9"
          />

          {/* Katup */}
          <path
            d="M520 447 V508 M590 447 V508"
            stroke="#F3FCF8"
            strokeWidth="16"
          />
          <path
            d="M524 452 V508 M586 452 V508 M524 466 H586"
            stroke="#285E37"
            strokeWidth="8"
          />
          <path d="M533 448 H544 M562 448 H573" stroke="#FFF" strokeWidth="9" />

          {/* Tetesan utama */}
          <path
            d="M411 336 C398 370 359 411 359 446 C359 477 381 498 411 498 C441 498 463 477 463 446 C463 411 424 370 411 336 Z"
            fill="url(#pw-drop)"
            stroke="#FFF"
            strokeWidth="9"
          />

          <path
            d="M398 384 C385 405 374 426 374 440 C374 448 378 451 384 450 C381 432 389 409 398 384 Z"
            fill="#EFFCFB"
          />

          {/* Tetesan kiri */}
          <path
            d="M286 372 C275 402 247 432 247 458 C247 482 263 498 286 498 C309 498 326 482 326 458 C326 432 297 402 286 372 Z"
            fill="url(#pw-drop)"
            stroke="#FFF"
            strokeWidth="8"
          />

          <path
            d="M312 445 C314 461 306 475 292 481 C302 481 313 474 316 464 C318 456 316 450 312 445 Z"
            fill="#F1FCFA"
          />

          {/* Tetesan kecil */}
          <path
            d="M500 534 C495 546 487 552 487 561 C487 578 512 578 512 561 C512 552 504 543 500 534Z"
            fill="#FFF"
          />

          {/* Roda gigi */}
          <use
            href="#pw-gear"
            transform="translate(234 162) scale(.73)"
            color="#193E50"
          />
          <use
            href="#pw-gear"
            transform="translate(207 259) scale(.59)"
            color="#6F9E4B"
          />
          <use
            href="#pw-gear"
            transform="translate(225 360) scale(.88)"
            color="#193E50"
          />
          <use
            href="#pw-gear"
            transform="translate(201 422) scale(.67)"
            color="#285E37"
          />
          <use
            href="#pw-gear"
            transform="translate(336 352) scale(.53)"
            color="#ED8B35"
          />
          <use
            href="#pw-gear"
            transform="translate(610 255) scale(.63)"
            color="#ED8B35"
          />

          {/* Status */}
          <use href="#pw-check" transform="translate(154 372)" />
          <use href="#pw-check" transform="translate(582 162) scale(.94)" />

          {/* Sensor lingkar kanan */}
          <circle cx="673" cy="371" r="23" fill="#193E50" />
          <circle cx="673" cy="371" r="12" fill="#F18B31" />
        </svg>
      </div>
    </div>
  );
}

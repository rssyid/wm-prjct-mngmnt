"use client";

import { motion, stagger, useAnimate } from "motion/react";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface QuoteItem {
  text: string;
  author: string;
}

export const LOGIN_QUOTES: QuoteItem[] = [
  {
    text: "Death is not the greatest loss in life. The greatest loss is what dies inside us while we live.",
    author: "Norman Cousins",
  },
  {
    text: "The only unbearable thing is that nothing is unbearable.",
    author: "Arthur Rimbaud",
  },
  {
    text: "If I can't dance, it's not my revolution!",
    author: "Emma Goldman",
  },
  {
    text: "To live is to suffer, to survive is to find some meaning in the suffering.",
    author: "Friedrich Nietzsche",
  },
  {
    text: "People know what they do; frequently they know why they do what they do; but what they don't know is what what they do does.",
    author: "Michel Foucault",
  },
];

export interface TextGenerateEffectProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  quotes?: QuoteItem[];
  filter?: boolean;
}

export function TextGenerateEffect({
  className,
  quotes = LOGIN_QUOTES,
  filter = true,
  ...props
}: TextGenerateEffectProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [scope, animate] = useAnimate();

  const currentQuote = quotes[currentIndex] || quotes[0];
  const quoteWords = React.useMemo(
    () => currentQuote.text.split(" "),
    [currentQuote.text]
  );
  const authorWords = React.useMemo(
    () => `— ${currentQuote.author}`.split(" "),
    [currentQuote.author]
  );

  React.useEffect(() => {
    let isMounted = true;

    const runCycle = async () => {
      if (!scope.current) return;

      const totalWords = quoteWords.length + authorWords.length;
      // Durasi total animasi kata awal sampai akhir persis 3 detik
      const animationTotalTime = 3.0;
      const wordAnimDuration = 0.5;
      const staggerDelay =
        totalWords > 1
          ? (animationTotalTime - wordAnimDuration) / (totalWords - 1)
          : 0.15;

      // 1. Reset kata ke blur dan transparan
      await animate(
        ".word-span",
        {
          opacity: 0,
          filter: filter ? "blur(10px)" : "none",
        },
        { duration: 0 }
      );

      if (!isMounted) return;

      // 2. Animasi masuk kata per kata (total selesai dalam 3.0 detik)
      await animate(
        ".word-span",
        {
          opacity: 1,
          filter: filter ? "blur(0px)" : "none",
        },
        {
          duration: wordAnimDuration,
          delay: stagger(staggerDelay),
        }
      );

      if (!isMounted) return;

      // 3. Diam selama 3 detik
      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (!isMounted) return;

      // 4. Memudar keluar sebelum ganti kutipan
      await animate(
        ".word-span",
        {
          opacity: 0,
          filter: filter ? "blur(8px)" : "none",
        },
        {
          duration: 0.35,
        }
      );

      if (!isMounted) return;

      // 5. Berpindah ke kutipan berikutnya secara berulang (looping)
      setCurrentIndex((prev) => (prev + 1) % quotes.length);
    };

    runCycle();

    return () => {
      isMounted = false;
    };
  }, [animate, authorWords.length, currentIndex, filter, quoteWords.length, quotes.length, scope]);

  return (
    <div
      className={cn("w-full max-w-xl mx-auto text-left select-none", className)}
      data-slot="text-generate-effect"
      {...props}
    >
      <div ref={scope} className="flex flex-col">
        {/* Teks kutipan utama */}
        <p className="text-2xl sm:text-3xl lg:text-4xl font-serif italic leading-relaxed text-slate-800 dark:text-slate-100">
          “
          {quoteWords.map((word, idx) => (
            <motion.span
              key={`quote-${currentIndex}-${word}-${idx}`}
              className="word-span inline-block mr-2 opacity-0 will-change-transform will-change-opacity will-change-filter"
              style={{
                filter: filter ? "blur(10px)" : "none",
              }}
            >
              {word}
            </motion.span>
          ))}
          ”
        </p>

        {/* Baris baru untuk nama penulis dengan dash */}
        <div className="mt-8 text-right">
          <p className="text-base sm:text-lg font-sans font-semibold tracking-wide text-primary">
            {authorWords.map((word, idx) => (
              <motion.span
                key={`author-${currentIndex}-${word}-${idx}`}
                className="word-span inline-block mr-1.5 opacity-0 will-change-transform will-change-opacity will-change-filter"
                style={{
                  filter: filter ? "blur(10px)" : "none",
                }}
              >
                {word}
              </motion.span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}

export default TextGenerateEffect;

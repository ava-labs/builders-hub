import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export const AnimatedWords = ({ words }: { words: string[] }) => {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-flex h-[1.1em] w-fit items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span
          key={words[index]}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ duration: 0.75, ease: "easeOut" }}
          className="text-[#1f66f4]"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

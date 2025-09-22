import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface AnimatedTitleProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  shouldAnimate?: boolean;
  underlineWords?: string[];
}

const AnimatedTitle: React.FC<AnimatedTitleProps> = ({ text, className, style, shouldAnimate = true, underlineWords = [] }) => {
  const shouldReduceMotion = useReducedMotion();

  const words = text.split(' ');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.025, delayChildren: i * 0.04 },
    }),
  };

  const childVariants = {
    visible: {
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: 'easeOut'
      },
    },
    hidden: {
      opacity: 0,
    },
  };
  
  const reducedMotionVariants = {
    hidden: { opacity: 1 },
    visible: { opacity: 1 },
  }

  return (
    <motion.h1
      className={`${className} max-w-text`}
      style={style}
      variants={shouldReduceMotion ? reducedMotionVariants : containerVariants}
      initial="hidden"
      animate={shouldAnimate ? "visible" : "hidden"}
      aria-label={text}
    >
      {words.map((word, wordIndex) => {
        const cleanedWord = word.replace(/[,.—]/g, '');
        const isUnderlined = underlineWords.includes(cleanedWord);
        const letters = Array.from(word);

        return (
          <motion.span
            key={wordIndex}
            className={isUnderlined ? 'hyperlink-style' : ''}
            style={{ display: 'inline-block', marginRight: '0.25em', position: 'relative' }}
            whileHover={isUnderlined ? "hover" : ""}
            initial="rest"
            animate="rest"
          >
            {letters.map((letter, letterIndex) => (
              <motion.span
                key={letterIndex}
                variants={shouldReduceMotion ? reducedMotionVariants : childVariants}
                aria-hidden="true"
              >
                {letter}
              </motion.span>
            ))}
            {isUnderlined && (
              <>
                <motion.span
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', backgroundColor: '#888888' }}
                />
                <motion.span
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', backgroundColor: 'black', originX: 0 }}
                  variants={{
                    rest: { scaleX: 0 },
                    hover: { scaleX: 1 }
                  }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </>
            )}
          </motion.span>
        );
      })}
    </motion.h1>
  );
};

export default AnimatedTitle;

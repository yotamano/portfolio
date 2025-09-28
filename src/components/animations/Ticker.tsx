import React, { useRef, useEffect, useState } from 'react';

interface TickerProps {
  text: string;
  className?: string;
  speed?: number; // pixels per second
}

const Ticker: React.FC<TickerProps> = ({ text, className = '', speed = 30 }) => {
  const [animationDuration, setAnimationDuration] = useState('1s');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      const width = contentRef.current.getBoundingClientRect().width;
      if (width > 0 && speed > 0) {
        setAnimationDuration(`${width / speed}s`);
      }
    }
  }, [text, speed]);

  const tickerStyle = {
    '--animation-duration': animationDuration,
    '--gap': '0.25rem',
    width: '50px',
    fontSize: '20px',
    color: '#888888',
    fontWeight: '400',
    lineHeight: '1.5',
    alignSelf: 'flex-start',
    marginTop: '0.1em',
  } as React.CSSProperties;

  const TickerContent = () => (
    <>
      <span>{text}</span>
      <span>{text}</span>
      <span>{text}</span>
    </>
  );

  return (
    <div className={`ticker-container ${className}`} style={tickerStyle}>
      <div className="ticker-content-wrapper" ref={contentRef}>
        <TickerContent />
      </div>
      <div className="ticker-content-wrapper" aria-hidden="true">
        <TickerContent />
      </div>
    </div>
  );
};

export default Ticker;

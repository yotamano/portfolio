import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import Head from 'next/head';
import Sidebar from './Sidebar';
import { PortfolioData } from '../types';
import { useHeader } from '../context/HeaderContext';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { AnimatedTitle } from './animations';

type LayoutProps = {
  children: React.ReactNode;
  portfolioData: PortfolioData | null;
  title?: string;
};

const Layout: React.FC<LayoutProps> = ({ children, portfolioData, title }) => {
  const siteTitle = title ? `${title} — Yotam's Portfolio` : "Yotam's Portfolio";
  const { headerState } = useHeader();
  const { isProjectTitleInView, projectName } = headerState;
  const [isScrolled, setIsScrolled] = useState(false);
  const hiImRefParagraph = useRef<HTMLSpanElement>(null);
  const [hiImWidthParagraph, setHiImWidthParagraph] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useLayoutEffect(() => {
    if (hiImRefParagraph.current) {
      setHiImWidthParagraph(hiImRefParagraph.current.offsetWidth);
    }
  }, [projectName]);

  const headerText = "Hi, I'm Yotam — designer working with AI and the web.";
  const nameToFind = "Yotam";
  const nameIndex = headerText.indexOf(nameToFind);
  const preText = headerText.substring(0, nameIndex);
  const postText = headerText.substring(nameIndex + nameToFind.length);
  const preWords = preText.trim().split(/\s+/);
  const postWords = postText.trim().split(/\s+/);

  return (
    <>
      <Head>
        <title>{siteTitle}</title>
        <meta name="description" content="A portfolio of design and development work." />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="main-layout">
        <AnimatePresence>
          {projectName && (
            <motion.header
              className={`zoom-level-0 content-padding active ${isScrolled ? 'scrolled' : ''} header-collapsible`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Link href="/?view=list" legacyBehavior>
                <a className="text-paragraph-style mb-0" aria-label={headerText}>
                  <span
                    ref={hiImRefParagraph}
                    style={{ display: 'inline-block', verticalAlign: 'bottom' }}
                    aria-hidden="true"
                  >
                    {preWords.map((word, i) => (
                      <motion.span
                        key={`pre-${i}`}
                        animate={{ opacity: isScrolled ? 0 : 1, x: isScrolled ? -5 : 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.03 }}
                        style={{ display: 'inline-block', marginRight: '0.25em' }}
                      >
                        {word}
                      </motion.span>
                    ))}
                  </span>
                  <motion.span
                    animate={{ x: isScrolled ? -hiImWidthParagraph : 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: 'inline-block', marginRight: '0.25em', position: 'relative' }}
                  >
                    {nameToFind}
                    <motion.span
                      style={{
                        display: 'inline-block',
                        whiteSpace: 'nowrap',
                        marginLeft: '0.25em',
                        position: 'absolute',
                        left: '100%',
                        top: 0,
                      }}
                      initial={{ opacity: 0, y: '100%' }}
                      animate={{
                        opacity: isScrolled && !isProjectTitleInView ? 1 : 0,
                        y: isScrolled && !isProjectTitleInView ? '0%' : '100%',
                      }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: isScrolled ? 0.1 : 0 }}
                    >
                      / {projectName}
                    </motion.span>
                  </motion.span>
                  <span className="hide-on-mobile">
                    <span
                      aria-hidden="true"
                      style={{ display: 'inline-block', verticalAlign: 'bottom' }}
                    >
                      {postWords.map((word, i) => (
                        <motion.span
                          key={`post-${i}`}
                          animate={{ opacity: isScrolled ? 0 : 1 }}
                          transition={{ duration: 0.2, ease: 'easeInOut', delay: (preWords.length + i) * 0.03 }}
                          style={{ display: 'inline-block', marginRight: '0.25em' }}
                        >
                          {word}
                        </motion.span>
                      ))}
                    </span>
                  </span>
                </a>
              </Link>
            </motion.header>
          )}
        </AnimatePresence>
        <main className="content-area">
          {children}
        </main>
      </div>
    </>
  );
};

export default Layout; 
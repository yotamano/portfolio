import React, { useState, useEffect } from 'react';
import { PortfolioData, ZoomContent } from '../types';
import { StreamedText, AnimatedTitle, StreamedParagraph, Ticker } from '../components/animations';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/router';

export default function HomePage({ portfolioData, zoomContent }: { portfolioData: PortfolioData; zoomContent?: ZoomContent }) {
  const [siteLevel, setSiteLevel] = useState<0 | 1>(0);
  const router = useRouter();

  useEffect(() => {
    if (router.query.view === 'list') {
      setSiteLevel(1);
    }
  }, [router.query]);

  const projects = portfolioData?.root?.children?.filter(item => item.type === 'project') || [];

  const handleHeaderClick = () => {
    if (siteLevel === 0) {
      setSiteLevel(1);
    }
  };

  const containerVariants = {
    hidden: {},
    visible: {},
    exit: { opacity: 0 }
  };

  return (
    <div className={`zoom-container`}>
      {/* L0: Site Header */}
      <div
        className={`zoom-level-0 content-padding ${siteLevel !== 0 ? 'active' : ''}`}
        onClick={handleHeaderClick}
      >
        <AnimatePresence mode="wait">
          {siteLevel === 0 ? (
            <motion.div
              key="l0-title"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <AnimatedTitle
                text={zoomContent?.siteHeader || "Hi, I'm Yotam — designer working with AI and the web."}
                className="text-paragraph-style mb-0"
                underlineWords={["Yotam"]}
              />
            </motion.div>
          ) : (
            <motion.div
              key="l1-title"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-baseline">
                <AnimatedTitle
                  text="Hi, I'm Yotam"
                  className="text-title-style"
                  style={{ marginBottom: 0, marginRight: 0 }}
                />
                <Ticker 
                  text="WIP" 
                  speed={25}
                />
              </div>
              <StreamedText
                text="designer working with AI and the web."
                className="text-paragraph-style mb-0"
                delay={0.5}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* L1+: Intro Paragraph */}
      <AnimatePresence>
        {siteLevel === 1 && (
          <motion.div
            className={`zoom-level-1 active`}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {zoomContent?.introContent && (
              <div className="intro-text-container content-padding">
                {zoomContent.introContent.map((paragraph, paragraphIndex) => (
                  <StreamedParagraph
                    key={paragraphIndex}
                    paragraph={paragraph}
                    projects={projects}
                    className="text-paragraph-style"
                    delay={paragraphIndex * 0.5}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export async function getStaticProps() {
  const fs = require('fs');
  const path = require('path');

  const contentPath = path.join(process.cwd(), 'public', 'content', 'content.json');
  const zoomContentPath = path.join(process.cwd(), 'public', 'content', 'zoom-content.json');

  let portfolioData = null;
  let zoomContent = null;

  try {
    const contentJson = fs.readFileSync(contentPath, 'utf8');
    portfolioData = JSON.parse(contentJson);
  } catch (error) {
    console.error('Could not read portfolio content.json:', error);
  }

  try {
    const zoomContentJson = fs.readFileSync(zoomContentPath, 'utf8');
    zoomContent = JSON.parse(zoomContentJson);
  } catch (error) {
    console.log('Could not read zoom-content.json (will use fallbacks):', error);
  }

  return {
    props: {
      portfolioData: portfolioData || { root: { id: '', name: '', path: '', type: 'folder' }, lastFetch: '' },
      zoomContent: zoomContent || null,
    },
  };
}
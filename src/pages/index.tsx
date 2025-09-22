import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { PortfolioData, PortfolioItem, ZoomContent } from '../types';
import Project from '../components/Project';
import { Shimmer, StreamedText, AnimatedTitle } from '../components/animations';
import { motion, AnimatePresence, animate } from 'framer-motion';

export default function HomePage({ portfolioData, zoomContent }: { portfolioData: PortfolioData; zoomContent?: ZoomContent }) {
  const [siteLevel, setSiteLevel] = useState<0 | 1>(0);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [visibleProjectIndex, setVisibleProjectIndex] = useState<number>(-1);
  const [animatedProjects, setAnimatedProjects] = useState<Set<number>>(new Set());
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProjectTitleInView, setIsProjectTitleInView] = useState(true);
  const [isProjectReadyForAnimations, setIsProjectReadyForAnimations] = useState(false);
  const [queuedProjectId, setQueuedProjectId] = useState<string | null>(null);
  const projectRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const hiImRefParagraph = useRef<HTMLSpanElement>(null);
  const [hiImWidthParagraph, setHiImWidthParagraph] = useState(0);

  useLayoutEffect(() => {
    if (hiImRefParagraph.current) {
      setHiImWidthParagraph(hiImRefParagraph.current.offsetWidth);
    }
  }, [expandedProjectId]);

  const scrollToProject = (projectId: string) => {
    // Wait for the next browser paint to ensure the layout is stable
    requestAnimationFrame(() => {
      const projectEl = projectRefs.current.get(projectId);
      if (projectEl) {
        const headerEl = document.querySelector('.zoom-level-0.active');
        const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
        const projectTop = projectEl.getBoundingClientRect().top + window.scrollY;
        const targetScrollY = projectTop - headerHeight - 20;

        // Use Framer Motion's animate for a smooth spring scroll
        // and a reliable onComplete callback
        const controls = animate(window.scrollY, targetScrollY, {
          type: 'spring',
          stiffness: 120,
          damping: 25,
          restDelta: 0.1,
          onUpdate: (latest) => window.scrollTo(0, latest),
          onComplete: () => {
            setIsProjectReadyForAnimations(true);
          }
        });
        return () => controls.stop();
      }
    });
  };

  const handleProjectClick = (projectId: string) => {
    const newProjectId = expandedProjectId === projectId ? null : projectId;
    setIsProjectReadyForAnimations(false);

    if (expandedProjectId && newProjectId && expandedProjectId !== newProjectId) {
      // It's a switch. Start collapsing the current project and expanding the new one concurrently.
      setExpandedProjectId(newProjectId);
      scrollToProject(newProjectId);
    } else if (newProjectId) {
      // It's an "open from index" action.
      setExpandedProjectId(newProjectId);
      scrollToProject(newProjectId);
    } else {
      // It's a "close" action.
      setExpandedProjectId(null);
    }
  };

  const handleCollapseComplete = () => {
    if (queuedProjectId) {
      setExpandedProjectId(queuedProjectId);
      setQueuedProjectId(null);
    }
  };

  const handleExpandComplete = () => {
    if (expandedProjectId) {
      scrollToProject(expandedProjectId);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const headerText = zoomContent?.siteHeader || "Hi, I'm Yotam — designer working with AI and the web.";
  const nameToFind = "Yotam";
  const nameIndex = headerText.indexOf(nameToFind);

  let preText = "";
  let postText = "";
  if (nameIndex > -1) {
    preText = headerText.substring(0, nameIndex);
    postText = headerText.substring(nameIndex + nameToFind.length);
  } else {
    preText = headerText;
  }

  const preWords = preText.trim().split(/\s+/);
  const postWords = postText.trim().split(/\s+/);

  // Get projects from the portfolio data
  const projects = portfolioData?.root?.children?.filter(item => item.type === 'project') || [];

  const expandedProject = expandedProjectId
    ? projects.find(p => p.id === expandedProjectId)
    : null;

  // Get zoom content for a project
  const getZoomProjectContent = (projectId: string) => {
    return zoomContent?.projects.find(p => p.id === projectId);
  };

  const handleHeaderClick = () => {
    if (siteLevel === 0) {
      setSiteLevel(1);
    } else if (siteLevel === 1 && expandedProjectId) {
      setExpandedProjectId(null);
    }
  };

  const handleProjectHoverStart = (projectId: string) => {
    setHoveredProjectId(projectId);
  };

  const handleProjectHoverEnd = () => {
    setHoveredProjectId(null);
  };

  // Reset and start the sequential animation when entering L1
  useEffect(() => {
    if (siteLevel === 1) {
      setVisibleProjectIndex(-1);
      setAnimatedProjects(new Set());
      // Start the first project after a small delay
      const timer = setTimeout(() => setVisibleProjectIndex(0), 100);
      return () => clearTimeout(timer);
    } else {
      setVisibleProjectIndex(-1);
      setAnimatedProjects(new Set());
    }
  }, [siteLevel]);

  const handleProjectAnimationComplete = (projectIndex: number) => {
    // Mark this project as animated
    setAnimatedProjects(prev => new Set([...Array.from(prev), projectIndex]));
    // Trigger the next project
    if (projectIndex + 1 < projects.length) {
      setVisibleProjectIndex(projectIndex + 1);
    }
  };

  const containerVariants = {
    hidden: {},
    visible: {},
    exit: { opacity: 0 }
  };

  const itemVariants = {
    hidden: {},
    visible: {},
  };

  return (
    <div className={`zoom-container`}>
      {siteLevel > 0 && (
        <div
          className="zoom-background"
          onClick={() => {
            setSiteLevel(0);
            setExpandedProjectId(null);
          }}
        />
      )}

      {/* L0: Site Header */}
      <div
        className={`zoom-level-0 content-padding ${siteLevel !== 0 ? 'active' : ''} ${isScrolled ? 'scrolled' : ''} ${expandedProjectId ? 'header-collapsible' : ''}`}
        onClick={handleHeaderClick}
      >
        {siteLevel === 0 ? (
          <AnimatedTitle
            text={zoomContent?.siteHeader || "Hi, I'm Yotam — designer working with AI and the web."}
            className="text-paragraph-style mb-0"
            underlineWords={["Yotam"]}
          />
        ) : (
          <div>
            <AnimatePresence mode="wait">
              {expandedProjectId ? (
                <motion.div
                  key="paragraph-title"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className="text-paragraph-style mb-0" aria-label={headerText}>
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
                      {expandedProject && (
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
                          / {expandedProject.name}
                        </motion.span>
                      )}
                    </motion.span>
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
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="main-title"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <AnimatedTitle
                    text="Hi, I'm Yotam"
                    className="text-title-style"
                    style={{ marginBottom: 0 }}
                  />
                  <StreamedText
                    text="designer working with AI and the web."
                    className="text-paragraph-style mb-0"
                    delay={0.5}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* L1+: Project Index */}
      <AnimatePresence>
        {siteLevel === 1 && (
          <motion.div
            className={`zoom-level-1 active`}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div className="project-index" variants={containerVariants}>
              {projects.map((project, index) => {
                const zoomProject = getZoomProjectContent(project.path);
                const isExpanded = expandedProjectId === project.id;
                const isHovered = hoveredProjectId === project.id;
                const hasBeenAnimated = animatedProjects.has(index);
                const shouldAnimate = hasBeenAnimated || visibleProjectIndex >= index;
                return (
                  <motion.div 
                    key={project.id} 
                    ref={(el) => { projectRefs.current.set(project.id, el); }}
                    variants={itemVariants}
                    custom={index}
                  >
                    <Project
                      project={project}
                      zoomProject={zoomProject}
                      isExpanded={isExpanded}
                      isHovered={isHovered}
                      onProjectClick={handleProjectClick}
                      onProjectHoverStart={handleProjectHoverStart}
                      onProjectHoverEnd={handleProjectHoverEnd}
                      listIndex={index}
                      shouldAnimate={shouldAnimate}
                      onAnimationComplete={() => handleProjectAnimationComplete(index)}
                      hasBeenAnimated={hasBeenAnimated}
                      onTitleInViewChange={isExpanded ? setIsProjectTitleInView : undefined}
                      isReadyForAnimations={isExpanded && isProjectReadyForAnimations}
                      onExpandComplete={handleExpandComplete}
                      onCollapseComplete={handleCollapseComplete}
                    />
                  </motion.div>
                );
              })}
            </motion.div>
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
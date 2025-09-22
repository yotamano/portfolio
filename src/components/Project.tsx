import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useInView } from 'framer-motion';
import { PortfolioItem, ZoomProject, MediaFile, L3Block } from '../types';
import { StreamedText, Shimmer, AnimatedTitle } from './animations';

const renderMedia = (media: MediaFile, index: number, isReady: boolean) => {
  const isVideo = media.mimeType.startsWith('video/');
  
  const mediaVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.4,
        delay: 0.4 + (index * 0.1),
        ease: 'easeOut'
      }
    }
  };

  if (isVideo) {
    return (
      <motion.video
        key={media.id}
        src={media.webViewLink}
        className="case-video"
        variants={mediaVariants}
        initial="hidden"
        animate={isReady ? "visible" : "hidden"}
        style={{ cursor: 'pointer' }}
        width={media.width}
        height={media.height}
        playsInline
        muted
        loop
        autoPlay
        onClick={(e) => {
          const video = e.currentTarget;
          video.muted = !video.muted;
        }}
      />
    );
  }
  return (
    <motion.img
      key={media.id}
      src={media.webViewLink}
      alt={media.name}
      className="case-image"
      variants={mediaVariants}
      initial="hidden"
      animate={isReady ? "visible" : "hidden"}
      width={media.width}
      height={media.height}
    />
  );
};

interface ProjectProps {
  project: PortfolioItem;
  zoomProject?: ZoomProject;
  isExpanded: boolean;
  isHovered: boolean;
  onProjectClick: (projectId: string) => void;
  onProjectHoverStart: (projectId: string) => void;
  onProjectHoverEnd: () => void;
  listIndex?: number;
  shouldAnimate?: boolean;
  onAnimationComplete?: () => void;
  hasBeenAnimated?: boolean;
  onTitleInViewChange?: (inView: boolean) => void;
  isReadyForAnimations?: boolean;
  onExpandComplete?: () => void;
  onCollapseComplete?: () => void;
}

const Project: React.FC<ProjectProps> = ({
  project,
  zoomProject,
  isExpanded,
  isHovered,
  onProjectClick,
  onProjectHoverStart,
  onProjectHoverEnd,
  listIndex = 0,
  shouldAnimate = false,
  onAnimationComplete,
  hasBeenAnimated = false,
  onTitleInViewChange,
  isReadyForAnimations = false,
  onExpandComplete,
  onCollapseComplete,
}) => {
  const heroImage = project.mediaFiles?.find(media => media.mimeType.startsWith('image/'));
  const imageWidth = heroImage?.width || 16;
  const imageHeight = heroImage?.height || 9;
  const aspectRatio = (imageHeight / imageWidth) * 100;

  const metadataParts = [zoomProject?.year, zoomProject?.medium, zoomProject?.role].filter(Boolean);
  const metadataText = metadataParts.join(' • ');

  const titleClassName = `transition-colors duration-300 ${isExpanded ? 'text-text-primary' : (isHovered ? 'text-text-primary' : 'text-text-secondary')}`;

  const titleContainerRef = useRef(null);
  const isTitleInView = useInView(titleContainerRef, { margin: "-100px 0px 0px 0px" });
  const isTitleScrolled = isExpanded && !isTitleInView;

  useEffect(() => {
    if (isExpanded) {
      onTitleInViewChange?.(isTitleInView);
    }
  }, [isExpanded, isTitleInView, onTitleInViewChange]);

  const [titleHeight, setTitleHeight] = useState(0);
  const largeTitleRef = useCallback((node: HTMLDivElement) => {
    if (node !== null) {
      setTitleHeight(node.offsetHeight);
    }
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const imageTranslateX = useTransform(mouseX, [0, containerWidth], [-10, 10]);
  const imageTranslateY = useTransform(mouseY, [0, containerHeight], [-10, 10]);

  const handleMouseMove = (event: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set(event.clientX - rect.left);
      mouseY.set(event.clientY - rect.top);
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
      setContainerHeight(containerRef.current.offsetHeight);
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
          setContainerHeight(entry.contentRect.height);
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [project.name]);

  return (
    <div
      ref={containerRef}
      className="project-container"
      onMouseEnter={() => onProjectHoverStart(project.id)}
      onMouseLeave={onProjectHoverEnd}
      onMouseMove={handleMouseMove}
    >
      {/* L1 & L2 Content */}
      <div className="project-row content-padding" onClick={() => onProjectClick(project.id)}>
        <div 
          ref={titleContainerRef}
          style={{ minHeight: isExpanded && titleHeight > 0 ? titleHeight : 'auto' }}
        >
          <AnimatePresence initial={false} mode="wait">
            {isExpanded ? (
              isTitleScrolled ? (
                <motion.div
                  key="l3-scrolled-title"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-paragraph-style">{project.name}</p>
                  {metadataText && <p className="text-paragraph-style text-text-secondary" style={{ marginTop: '-1rem' }}>{metadataText}</p>}
                </motion.div>
              ) : (
                <motion.div
                  ref={largeTitleRef}
                  key="l3-title"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <AnimatedTitle text={project.name} className="text-title-style" />
                  {metadataText && <StreamedText text={metadataText} className="text-paragraph-style text-text-secondary" delay={0.1} />}
                </motion.div>
              )
            ) : (
              <motion.div
                key="l1-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-paragraph-style">
                  <motion.span 
                    className={`${titleClassName} hyperlink-style`}
                    style={{ position: 'relative' }}
                    whileHover="hover"
                    initial="rest"
                    animate="rest"
                  >
                    {project.name}
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
                  </motion.span>
                  {metadataText && <span className="text-text-secondary ml-2">{`(${metadataText})`}</span>}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* L2 Image (absolutely positioned, fades in) */}
      <AnimatePresence>
        {isHovered && !isExpanded && heroImage && (
          <div className="hover-image-container">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{
                x: imageTranslateX,
                y: imageTranslateY,
              }}
            >
              <div className="w-48">
                <Shimmer>
                  <div
                    className="project-card-image"
                    style={{
                      position: 'relative',
                      width: '100%',
                      paddingBottom: `${aspectRatio}%`, // Maintain aspect ratio
                    }}
                  >
                    <img
                      src={heroImage.webViewLink}
                      alt={project.name}
                      className="hero-image"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      loading="lazy"
                    />
                  </div>
                </Shimmer>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* L3: Full Case Study */}
      <AnimatePresence onExitComplete={onCollapseComplete}>
        {isExpanded && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="full-case"
            onAnimationComplete={onExpandComplete}
          >
            <div className="case-content">
              {zoomProject?.l3 ? (
                <div className="case-text content-padding">
                  {zoomProject.l3.map((block, index) => {
                    switch (block.type) {
                      case 'heading':
                        return (
                          <AnimatedTitle
                            key={`l3-block-${index}-${project.id}`}
                            text={block.content}
                            className="text-title-style"
                            style={{ marginTop: index > 0 ? '2rem' : '0', marginBottom: '1rem' }}
                          />
                        );
                      case 'paragraph':
                        return (
                          <StreamedText
                            key={`l3-block-${index}-${project.id}`}
                            className="text-paragraph-style"
                            text={block.content}
                            shouldAnimate={isReadyForAnimations}
                            delay={0.2 + index * 0.1}
                          />
                        );
                      case 'link':
                        return (
                          <motion.p
                            key={`l3-block-${index}-${project.id}`}
                            className="text-paragraph-style"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 + index * 0.1 }}
                          >
                            <a href={block.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-text-primary">
                              {block.text}
                            </a>
                          </motion.p>
                        );
                      default:
                        return null;
                    }
                  })}
                </div>
              ) : project.content ? (
                <div className="case-text content-padding">
                  {project.content.split('\n\n').map((paragraph, index) => (
                    <StreamedText key={`l3-p-${index}-${project.id}`} className="text-paragraph-style" text={paragraph} shouldAnimate={isReadyForAnimations} delay={0.2 + index * 0.1} />
                  ))}
                </div>
              ) : null}

              {project.mediaLayouts && project.mediaLayouts.length > 0 && (
                <motion.div
                  className="case-media-container"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  {project.mediaLayouts.map((layoutGroup, groupIndex) => {
                    const { layout, media } = layoutGroup;
                    const renderMediaWithProps = (mediaFile: MediaFile, index: number) => renderMedia(mediaFile, index, isReadyForAnimations);

                    switch (layout) {
                      case 'A':
                        return (
                          <div key={groupIndex} className="layout-a">
                            {media.map(renderMediaWithProps)}
                          </div>
                        );
                      case 'B':
                        return (
                          <div key={groupIndex} className="layout-b black-container">
                            {media.map(renderMediaWithProps)}
                          </div>
                        );
                      case 'C':
                        return (
                          <div key={groupIndex} className="layout-c black-container">
                            {media.map(renderMediaWithProps)}
                          </div>
                        );
                      case 'D':
                        return (
                          <div key={groupIndex} className="layout-d black-container">
                            {media.map(renderMediaWithProps)}
                          </div>
                        );
                      default:
                        return null;
                    }
                  })}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Project;

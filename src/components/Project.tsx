import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { PortfolioItem, ZoomProject } from '../types';
import { Shimmer } from './animations';

interface ProjectProps {
  project: PortfolioItem;
  zoomProject?: ZoomProject;
  isHovered: boolean;
  onProjectHoverStart: (projectId: string) => void;
  onProjectHoverEnd: () => void;
}

const Project: React.FC<ProjectProps> = ({
  project,
  zoomProject,
  isHovered,
  onProjectHoverStart,
  onProjectHoverEnd,
}) => {
  const heroImage = project.mediaFiles?.find(media => media.mimeType.startsWith('image/'));

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
  
  const metadataParts = [zoomProject?.year, zoomProject?.medium, zoomProject?.role].filter(Boolean);
  const metadataText = metadataParts.join(' • ');

  const titleClassName = `transition-colors duration-300 ${isHovered ? 'text-text-primary' : 'text-text-secondary'}`;

  return (
    <div
      ref={containerRef}
      className="project-container"
      onMouseEnter={() => onProjectHoverStart(project.id)}
      onMouseLeave={onProjectHoverEnd}
      onMouseMove={handleMouseMove}
    >
      {/* L1 & L2 Content */}
      <div className="project-row content-padding">
        <div>
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
        </div>
      </div>

      {/* L2 Image (absolutely positioned, fades in) */}
      {isHovered && heroImage && (
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
            <div className="w-[250px] h-[250px]">
              <Shimmer>
                <div
                  className="project-card-image"
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
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
    </div>
  );
};

export default Project;

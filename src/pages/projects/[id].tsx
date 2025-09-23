import { GetStaticPaths, GetStaticProps } from 'next';
import { PortfolioData, PortfolioItem, ZoomProject, ZoomContent, L3Block, MediaFile } from '../../types';
import fs from 'fs';
import path from 'path';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useInView, useScroll } from 'framer-motion';
import { StreamedText, Shimmer, AnimatedTitle } from '../../components/animations';
import { ExternalLinkIcon } from '../../components/animations/Icon';
import { useHeader } from '../../context/HeaderContext';

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

type ProjectPageProps = {
  project: PortfolioItem;
  zoomProject?: ZoomProject;
};

export default function ProjectPage({ project, zoomProject }: ProjectPageProps) {
    const [mainContentBlocks, setMainContentBlocks] = useState<L3Block[]>([]);
    const [metadataBlocks, setMetadataBlocks] = useState<L3Block[]>([]);
    const creditsRef = useRef(null);
    const { setHeaderState } = useHeader();
    const titleRef = useRef(null);
    const isTitleInView = useInView(titleRef, { margin: "-100px 0px 0px 0px" });

    useEffect(() => {
        setHeaderState({
            isProjectTitleInView: isTitleInView,
            projectName: project.name
        });

        // Cleanup function to reset header state when leaving the page
        return () => {
            setHeaderState({
                isProjectTitleInView: true,
                projectName: null
            });
        };
    }, [isTitleInView, project.name, setHeaderState]);
  
    useEffect(() => {
      if (zoomProject?.l3) {
        const main: L3Block[] = [];
        const meta: L3Block[] = [];
        zoomProject.l3.forEach(block => {
          if (block.type === 'link' || block.type === 'credits') {
            meta.push(block);
          } else {
            main.push(block);
          }
        });
        setMainContentBlocks(main);
        setMetadataBlocks(meta);
      }
    }, [zoomProject?.l3]);
  
    if (!project) {
      return <div>Project not found.</div>;
    }

    const metadataParts = [zoomProject?.year, zoomProject?.medium, zoomProject?.role].filter(Boolean);
    const metadataText = metadataParts.join(' • ');
  
    return (
      <div className="project-page-container">
        <div className="content-padding" ref={titleRef}>
          <AnimatedTitle text={project.name} className="text-title-style" />
          {metadataText && <StreamedText text={metadataText} className="text-paragraph-style text-text-secondary" delay={0.1} />}
        </div>
  
        <div className="full-case">
          <div className="case-content">
            <div className="case-text content-padding">
              {(mainContentBlocks.length > 0 ? mainContentBlocks : zoomProject?.l3)?.map((block, index) => {
                switch (block.type) {
                  case 'heading':
                    return (
                      <motion.div
                        key={`l3-block-${index}-${project.id}`}
                        style={{ marginTop: index > 0 ? '2rem' : '0', marginBottom: '2rem' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 + index * 0.1 }}
                      >
                        <p className="text-paragraph-style">{block.content}</p>
                      </motion.div>
                    );
                  case 'paragraph':
                    return (
                      <StreamedText
                        key={`l3-block-${index}-${project.id}`}
                        className="text-paragraph-style"
                        text={block.content}
                        shouldAnimate={true}
                        delay={0.2 + index * 0.1}
                      />
                    );
                  default:
                    return null;
                }
              })}
            </div>
  
            {project.mediaLayouts && project.mediaLayouts.length > 0 && (
              <motion.div
                className="case-media-container"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                {project.mediaLayouts.map((layoutGroup, groupIndex) => {
                  const { layout, media } = layoutGroup;
                  const renderMediaWithProps = (mediaFile: MediaFile, index: number) => renderMedia(mediaFile, index, true);
  
                  switch (layout) {
                    case 'A':
                      return (
                        <div key={groupIndex} className="layout-a black-container">
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
  
            <div ref={creditsRef} className="case-text content-padding" style={{ marginTop: '2rem' }}>
              {metadataBlocks.map((block, index) => {
                switch (block.type) {
                  case 'link':
                    return (
                      <motion.p
                        key={`l3-meta-block-${index}-${project.id}`}
                        className="text-paragraph-style"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 + index * 0.1 }}
                      >
                        <a href={block.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-text-primary">
                          {block.text}
                          <ExternalLinkIcon />
                        </a>
                      </motion.p>
                    );
                  case 'credits':
                    return (
                      <motion.div
                        key={`l3-meta-block-${index}-${project.id}`}
                        className="credits-grid"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 + index * 0.1 }}
                      >
                        {block.items.map((item, itemIndex) => (
                          <React.Fragment key={itemIndex}>
                            <p className="text-paragraph-style text-text-secondary">{item.role}</p>
                            {item.url ? (
                              <p className="text-paragraph-style">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-text-primary">
                                  {item.name}
                                  <ExternalLinkIcon />
                                </a>
                              </p>
                            ) : (
                              <p className="text-paragraph-style">{item.name}</p>
                            )}
                          </React.Fragment>
                        ))}
                      </motion.div>
                    );
                  default:
                    return null;
                }
              })}
            </div>
          </div>
        </div>
        <div style={{ height: '350px' }} />
      </div>
    );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const contentPath = path.join(process.cwd(), 'public', 'content', 'content.json');
  const contentJson = fs.readFileSync(contentPath, 'utf8');
  const portfolioData: PortfolioData = JSON.parse(contentJson);

  const projects = portfolioData.root.children?.filter(item => item.type === 'project') || [];
  
  const paths = projects.map(project => ({
    params: { id: project.id },
  }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { id } = context.params as { id: string };
  const contentPath = path.join(process.cwd(), 'public', 'content', 'content.json');
  const contentJson = fs.readFileSync(contentPath, 'utf8');
  const portfolioData: PortfolioData = JSON.parse(contentJson);

  const projects = portfolioData.root.children?.filter(item => item.type === 'project') || [];
  const project = projects.find(p => p.id === id);

  if (!project) {
    return {
      notFound: true,
    };
  }

  const zoomContentPath = path.join(process.cwd(), 'public', 'content', 'zoom-content.json');
  let zoomProject: ZoomProject | null = null;
  try {
    const zoomContentJson = fs.readFileSync(zoomContentPath, 'utf8');
    const zoomContent: ZoomContent = JSON.parse(zoomContentJson);
    zoomProject = zoomContent.projects.find(p => p.id === project.path) || null;
  } catch (error) {
    console.log('Could not read zoom-content.json for project page (will use fallbacks):', error);
  }

  return {
    props: {
      project,
      zoomProject,
    },
  };
};

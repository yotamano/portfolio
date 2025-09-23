import React, { useState, useRef, useEffect } from 'react';
import { motion, useReducedMotion, useMotionValue, useTransform } from 'framer-motion';
import Link from 'next/link';
import { PortfolioItem } from '../../types';
import { Shimmer } from '.';

type ParsedContentSegment =
    | { type: 'text'; content: string }
    | { type: 'projectLink'; text: string; projectId: string }
    | { type: 'pageLink'; text: string; path: string }
    | { type: 'emailLink'; text: string; email: string }
    | { type: 'externalLink'; text: string; url: string };

type ParsedParagraph = ParsedContentSegment[];
interface StreamedParagraphProps {
    paragraph: ParsedParagraph;
    projects: PortfolioItem[];
    className?: string;
    delay?: number;
    shouldAnimate?: boolean;
    onAnimationComplete?: () => void;
}

const StreamedParagraph: React.FC<StreamedParagraphProps> = ({
    paragraph,
    projects,
    className,
    delay = 0,
    shouldAnimate = true,
    onAnimationComplete,
}) => {
    const shouldReduceMotion = useReducedMotion();
    let wordIndex = 0;
    const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
    const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

    const containerRef = useRef<HTMLParagraphElement>(null);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const imageTranslateX = useTransform(mouseX, [-100, 100], [-15, 15]);
    const imageTranslateY = useTransform(mouseY, [-100, 100], [-15, 15]);

    const handleMouseMove = (event: React.MouseEvent) => {
        // Update mouse position for fixed positioning relative to viewport
        mouseX.set(event.clientX);
        mouseY.set(event.clientY);
    };

    const handleEmailCopy = (email: string) => {
        navigator.clipboard.writeText(email);
        setCopiedEmail(email);
        setTimeout(() => {
            setCopiedEmail(null);
        }, 2000); // Reset after 2 seconds
    };
    
    const hoveredProject = hoveredProjectId ? projects.find(p => p.id === hoveredProjectId) : null;
    
    // Debug logging
    if (hoveredProjectId && !hoveredProject) {
        console.log('Could not find project:', hoveredProjectId);
        console.log('Available project IDs:', projects.map(p => p.id));
    }
    
    // Select the best thumbnail - prioritize first media from first layout, then fall back to first image/video
    const getBestThumbnail = (project: PortfolioItem) => {
        // First, try to get media from the first layout (curated content)
        if (project.mediaLayouts && project.mediaLayouts.length > 0) {
            const firstLayoutMedia = project.mediaLayouts[0].media;
            if (firstLayoutMedia && firstLayoutMedia.length > 0) {
                return firstLayoutMedia[0];
            }
        }
        
        // Fall back to first image or video from mediaFiles
        return project.mediaFiles?.find(media => 
            media.mimeType.startsWith('image/') || media.mimeType.startsWith('video/')
        );
    };
    
    const heroMedia = hoveredProject ? getBestThumbnail(hoveredProject) : null;


    const containerVariants = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: 0.02,
                delayChildren: delay,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0 },
        visible: (i: number) => ({
            opacity: 1,
            transition: {
                delay: i * 0.02,
                duration: 0.15,
                ease: "easeOut",
            },
        }),
    };

    const reducedMotionVariants = {
        hidden: { opacity: 1 },
        visible: { opacity: 1 },
    };

    const variants = shouldReduceMotion ? reducedMotionVariants : itemVariants;

    return (
        <motion.p
            ref={containerRef}
            className={`${className} max-w-text relative`}
            variants={shouldReduceMotion ? {} : containerVariants}
            initial="hidden"
            animate={shouldAnimate ? "visible" : "hidden"}
            onAnimationComplete={onAnimationComplete}
            onMouseMove={handleMouseMove}
        >
            {paragraph.map((segment, segmentIndex) => {
                if (segment.type === 'text') {
                    const words = segment.content.split(/(\s+)/); // Split by space but keep spaces
                    return words.map((word, i) => {
                        if (word.trim() === '') {
                            return <span key={`${segmentIndex}-${i}`}>{word}</span>;
                        }
                        const currentIndex = wordIndex++;
                        return (
                            <motion.span
                                key={`${segmentIndex}-${i}-${currentIndex}`}
                                variants={variants}
                                custom={currentIndex}
                                style={{ display: 'inline-block' }}
                            >
                                {word}
                            </motion.span>
                        );
                    });
                }

                const currentIndex = wordIndex++;
                if (segment.type === 'projectLink') {
                    // Debug: log the project link being processed
                    console.log('Processing project link:', segment.projectId, segment.text);
                    
                    return (
                        <Link href={`/projects/${segment.projectId}`} key={`${segmentIndex}-${currentIndex}`} legacyBehavior passHref>
                            <motion.a
                                className="hyperlink-style"
                                style={{ position: 'relative' }}
                                onMouseEnter={() => {
                                    console.log('Hovering project:', segment.projectId);
                                    setHoveredProjectId(segment.projectId);
                                }}
                                onMouseLeave={() => setHoveredProjectId(null)}
                                whileHover="hover"
                                initial="rest"
                                animate="rest"
                                variants={variants}
                                custom={currentIndex}
                            >
                                {segment.text}
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
                            </motion.a>
                        </Link>
                    );
                }

                if (segment.type === 'pageLink') {
                    return (
                        <Link href={segment.path} key={`${segmentIndex}-${currentIndex}`} legacyBehavior passHref>
                            <motion.a
                                className="hyperlink-style"
                                style={{ position: 'relative' }}
                                whileHover="hover"
                                initial="rest"
                                animate="rest"
                                variants={variants}
                                custom={currentIndex}
                            >
                                {segment.text}
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
                            </motion.a>
                        </Link>
                    );
                }

                if (segment.type === 'emailLink') {
                    return (
                        <motion.button
                            key={`${segmentIndex}-${currentIndex}`}
                            onClick={() => handleEmailCopy(segment.email)}
                            className="hyperlink-style"
                            style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginRight: '20px' }}
                            whileHover="hover"
                            initial="rest"
                            animate="rest"
                            variants={variants}
                            custom={currentIndex}
                        >
                            {copiedEmail === segment.email ? 'Copied!' : segment.text}
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
                        </motion.button>
                    );
                }

                if (segment.type === 'externalLink') {
                    return (
                        <motion.a
                            key={`${segmentIndex}-${currentIndex}`}
                            href={segment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hyperlink-style"
                            style={{ position: 'relative', marginRight: '20px' }}
                            whileHover="hover"
                            initial="rest"
                            animate="rest"
                            variants={variants}
                            custom={currentIndex}
                        >
                            {segment.text}
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
                        </motion.a>
                    );
                }
                return null;
            })}
             {heroMedia && (
                 <motion.div
                     className="hover-image-container"
                     style={{
                         position: 'fixed', // Use fixed positioning to escape parent bounds
                         top: mouseY,
                         left: mouseX,
                         translateX: '20px', // Offset to the right of the cursor
                         translateY: '-50%', // Center vertically on the cursor
                         pointerEvents: 'none',
                         zIndex: 1000
                     }}
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.9 }}
                     transition={{ duration: 0.2, ease: 'easeOut' }}
                 >
                     <div style={{ width: '250px', height: '250px' }}>
                         <Shimmer>
                             {heroMedia.mimeType.startsWith('video/') ? (
                                 <video
                                     src={heroMedia.webViewLink}
                                     className="hero-image"
                                     style={{
                                         width: '250px',
                                         height: '250px',
                                         objectFit: 'cover',
                                     }}
                                     playsInline
                                     muted
                                     loop
                                     autoPlay
                                 />
                             ) : (
                                 <img
                                     src={heroMedia.webViewLink}
                                     alt={heroMedia.name}
                                     className="hero-image"
                                     style={{
                                         width: '250px',
                                         height: '250px',
                                         objectFit: 'cover',
                                     }}
                                 />
                             )}
                         </Shimmer>
                     </div>
                 </motion.div>
             )}
        </motion.p>
    );
};

export default StreamedParagraph;

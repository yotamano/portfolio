import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import { getPortfolioData } from '../lib/driveApi';
import { ContentItem, MediaLayout } from '../types';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { v2 as cloudinary } from 'cloudinary';
import axios from 'axios';
import { MediaFile } from '../types';
import { createHash } from 'crypto';


// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CONTENT_DIR = path.join(process.cwd(), 'public', 'content');
const MANIFEST_FILE = path.join(CONTENT_DIR, '.asset-manifest.json');
const LAYOUT_CACHE_FILE = path.join(CONTENT_DIR, '.layout-cache.json');
const PROJECT_CACHE_FILE = path.join(CONTENT_DIR, '.project-cache.json');

type ManifestSuccessEntry = {
  status: 'success';
  cloudinaryPublicId: string;
  driveModifiedTime: string;
  cloudinaryUrl: string;
  width?: number;
  height?: number;
};

type ManifestFailureEntry = {
  status: 'failed';
  driveModifiedTime: string;
  failureReason: string;
};

type AssetManifest = {
  [driveId: string]: ManifestSuccessEntry | ManifestFailureEntry;
};

type ParsedContentSegment = 
  | { type: 'text'; content: string }
  | { type: 'projectLink'; text: string; projectId: string }
  | { type: 'pageLink'; text: string; path: string }
  | { type: 'externalLink'; text: string; url: string }
  | { type: 'emailLink'; text: string; email: string };

type ParsedParagraph = ParsedContentSegment[];

type LayoutCache = {
  [projectId: string]: {
    mediaSignature: string;
    layouts: MediaLayout[];
  }
};

type ProjectCache = {
  [projectId: string]: {
    projectSignature: string;
    zoomContent: any;
  }
};

const ERROR_LOG_FILE = path.join(process.cwd(), '.upload-errors.log');


// Load or initialize the asset manifest
function loadManifest(): AssetManifest {
  if (fs.existsSync(MANIFEST_FILE)) {
    return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
  }
  return {};
}

// Save the asset manifest
function saveManifest(manifest: AssetManifest) {
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

// Load or initialize the layout cache
function loadLayoutCache(): LayoutCache {
  if (fs.existsSync(LAYOUT_CACHE_FILE)) {
    return JSON.parse(fs.readFileSync(LAYOUT_CACHE_FILE, 'utf-8'));
  }
  return {};
}

// Save the layout cache
function saveLayoutCache(cache: LayoutCache) {
  fs.writeFileSync(LAYOUT_CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Load or initialize the project cache
function loadProjectCache(): ProjectCache {
  if (fs.existsSync(PROJECT_CACHE_FILE)) {
    return JSON.parse(fs.readFileSync(PROJECT_CACHE_FILE, 'utf-8'));
  }
  return {};
}

// Save the project cache
function saveProjectCache(cache: ProjectCache) {
  fs.writeFileSync(PROJECT_CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Create a signature for a project's media files to check for changes
function createMediaSignature(mediaFiles: MediaFile[]): string {
  if (!mediaFiles || mediaFiles.length === 0) {
    return '';
  }
  // Create a consistent string representation of the media files
  const signatureString = mediaFiles
    .map(f => `${f.id}-${f.modifiedTime}`)
    .sort()
    .join('|');
  
  // Return a hash of the string
  return createHash('sha256').update(signatureString).digest('hex');
}

// Create a signature for a project's content to check for changes
function createProjectSignature(project: ContentItem): string {
  if (!project) {
    return '';
  }
  const mediaSignature = (project.mediaFiles || [])
    .map(f => `${f.id}-${f.modifiedTime}`)
    .sort()
    .join('|');

  // Use a stable serialization of the project content
  const contentString = JSON.stringify({
    id: project.id,
    name: project.name,
    content: project.content,
    path: project.path,
    media: mediaSignature,
  });

  return createHash('sha256').update(contentString).digest('hex');
}

// Function to upload a file to Cloudinary from a stream
async function uploadToCloudinary(driveFile: any, parentPath: string): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const nameWithoutExtension = driveFile.name.lastIndexOf('.') > 0 
      ? driveFile.name.substring(0, driveFile.name.lastIndexOf('.')) 
      : driveFile.name;
      
    // Sanitize for characters that are problematic in URLs/public_ids
    const sanitizedName = nameWithoutExtension.replace(/&/g, 'and').replace(/[/\\?%*:|"<>]/g, '-');

    const public_id = `${parentPath}/${sanitizedName}`;

    const downloader = await axios({
      url: `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media`,
      method: 'GET',
      responseType: 'stream',
      headers: {
        Authorization: `Bearer ${await getDriveAuthToken()}`,
      },
    });

    const upload_stream = cloudinary.uploader.upload_stream(
      {
        public_id,
        resource_type: driveFile.mimeType.startsWith('video') ? 'video' : 'image',
        overwrite: true,
        folder: 'drive-portfolio', // Optional: organize in a folder in Cloudinary
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );

    downloader.data.pipe(upload_stream);
  });
}

// Helper to get an auth token for Drive API calls
async function getDriveAuthToken() {
    const auth = new (require('google-auth-library').GoogleAuth)({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!),
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
}


const LAST_FETCH_FILE = path.join(CONTENT_DIR, '.last-fetch');

// New LLM-based layout analysis function
async function analyzeMediaLayoutsWithLLM(mediaFiles: MediaFile[]): Promise<MediaLayout[]> {
  if (!mediaFiles || mediaFiles.length === 0) return [];

  const mediaInfo = mediaFiles.map(m => ({
    id: m.id,
    name: m.name,
    type: m.mimeType.startsWith('video') ? 'video' : 'image',
    width: m.width,
    height: m.height,
    aspectRatio: m.width && m.height ? (m.width / m.height).toFixed(2) : 'unknown'
  }));

  const prompt = `
    You are a visual designer tasked with creating a dynamic layout for a project portfolio.
    Given a list of media assets, group them into layouts based on the following rules.

    LAYOUT DEFINITIONS:
    - A: Full bleed image/video (no padding). Use for the most impactful, high-res, landscape-oriented asset. Max 1 per project.
    - B: 2 side-by-side media in a container. Good for vertical images or related items.
    - C: 3-4 smaller media in a container. Ideal for smaller assets, UI details, or a series of related images.
    - D: Single asset in a container. For important assets that don't fit full-bleed.

    PRIORITIZATION LOGIC:
    1.  **Importance (for Layout A):** Look for a clear "hero" image or video. Titles like "main", "hero", "cover" are strong indicators. A high-resolution, landscape-oriented image is preferred.
    2.  **Vertical Assets (for Layout B):** Group vertical assets (aspect ratio < 0.9) in pairs.
    3.  **Small/Detailed Assets (for Layout C):** Group smaller dimension assets or a series of related assets into groups of 3 or 4.
    4.  **Standalone Assets (for Layout D):** Use for any remaining important assets.

    MEDIA ASSETS:
    ${JSON.stringify(mediaInfo, null, 2)}

    TASK:
    Return a JSON array of layout objects. Each object must have a "layout" property (A, B, C, or D) and a "media_ids" property containing an array of the corresponding media IDs.
    The output must be a valid JSON array. Example:
    [
      { "layout": "A", "media_ids": ["1..."] },
      { "layout": "B", "media_ids": ["2...", "3..."] }
    ]
    IMPORTANT: ONLY return the JSON array. Do not include any conversational text, explanations, or markdown.
  `;

  try {
    const { textStream } = await streamText({
      model: openai('gpt-5'),
      prompt,
      temperature: 1,
    });

    let jsonString = '';
    for await (const delta of textStream) {
      jsonString += delta;
    }

    // More robust JSON extraction to handle conversational text from the LLM
    const startIndex = jsonString.indexOf('[');
    const endIndex = jsonString.lastIndexOf(']');
    
    if (startIndex === -1 || endIndex === -1) {
      console.error("LLM Response:", jsonString);
      throw new Error('No valid JSON array found in LLM response.');
    }

    const cleanJsonString = jsonString.substring(startIndex, endIndex + 1);
    const layoutInstructions = JSON.parse(cleanJsonString) as { layout: 'A' | 'B' | 'C' | 'D'; media_ids: string[] }[];

    // Map the LLM output back to the full MediaFile objects
    const mediaLayouts: MediaLayout[] = layoutInstructions.map(instruction => {
      const mediaInLayout = instruction.media_ids
        .map(id => mediaFiles.find(m => m.id === id))
        .filter((m): m is MediaFile => !!m);
      return {
        layout: instruction.layout,
        media: mediaInLayout,
      };
    });

    return mediaLayouts;

  } catch (error) {
    console.error('Error analyzing media layouts with LLM:', error);
    // Fallback to a simple single-column layout in case of error
    return [{
      layout: 'D',
      media: mediaFiles
    }];
  }
}

function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readLastFetch(): string | null {
  if (fs.existsSync(LAST_FETCH_FILE)) {
    return fs.readFileSync(LAST_FETCH_FILE, 'utf-8');
  }
  return null;
}

function writeLastFetch() {
  fs.writeFileSync(LAST_FETCH_FILE, new Date().toISOString());
}

// Generate zoom-level content for a single project
async function generateProjectZoomContent(project: ContentItem): Promise<any> {
  console.log(`Generating zoom content for: ${project.name}`);

  const projectContent = {
    name: project.name,
    content: project.content || '',
    mediaFiles: (project.mediaFiles || []).map(f => f.name).join(', '),
    path: project.path
  };

  const prompt = `
You are a content extraction engine. Your task is to process the provided project content, which is a single block of text containing sections marked with headings like "L1", "L2", and "L3". Your job is to parse this text and generate a clean JSON object.

Your primary directive is to preserve the original text and tone. You must not improvise or rewrite content. Your only allowed modifications are to fix obvious typos.

PROJECT CONTENT TO PROCESS:
${JSON.stringify(projectContent, null, 2)}

Please generate a structured JSON object by following these exact parsing rules:
1.  Find the text associated with the "L1" heading and place it in the "l1" field.
2.  Find the text associated with the "L2" heading and place it in the "l2" field.
3.  Find the text associated with the "L3" heading. Parse ONLY this section into a JSON array of blocks for the "l3" field.
    - A short line of text followed by a line break should be treated as a 'heading'. Ignore headings titled "Links" or "Credits".
    - Any standalone hyperlinks should be extracted into a 'link' object. The link text should be the title of the link, not the full URL.
    - Any lines matching the pattern "[role]: [name]" should be grouped together into a single 'credits' object. If the name contains a link, extract the URL and associate it with the name.
    - All other text should be treated as a 'paragraph'.

Return a JSON object with this exact structure:
{
    "id": "project-path",
    "l1": "The extracted L1 content goes here.",
    "l2": "The extracted L2 content goes here.",
    "l3": [
      { "type": "heading", "content": "This is an inner title from the L3 section" },
      { "type": "paragraph", "content": "This is a paragraph from the L3 section." },
      { "type": "link", "url": "https://example.com", "text": "Visit the Live Site" },
      { "type": "credits", "items": [{ "role": "Team", "name": "Yuval Hadar", "url": "https://yuvalhadar.com/" }] }
    ],
    "year": "The extracted year",
    "medium": "The extracted medium",
    "role": "The extracted role"
}

IMPORTANT:
- Extract all information directly from the provided content by parsing the sections as described.
- Do not paraphrase or generate new text.
- Use the project's actual path as the id.
- The output must be ONLY the JSON object.
`;

  try {
    const { textStream } = await streamText({
      model: openai('gpt-5'),
      prompt,
      temperature: 1,
    });

    let jsonString = '';
    for await (const delta of textStream) {
      jsonString += delta;
    }

    const cleanJsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonString);
  } catch (error) {
    console.error(`Error generating zoom content for ${project.name}:`, error);
    // Return a fallback structure for this specific project
    return {
      id: project.path,
      l1: `${project.name} (2024) Web Development Technical Lead`,
      l2: `Interactive experience built with modern web technologies for creative professionals.`,
      l3: [
        {"type": "paragraph", "content": "Traditional portfolio websites lack engaging interaction patterns."},
        {"type": "paragraph", "content": "Built an innovative zoom-based navigation system with seamless transitions."},
        {"type": "paragraph", "content": "Created an immersive experience that feels like AI-generated content expansion."},
        {"type": "credits", "items": [{"role": "Designer", "name": "Yotam Mano"}]}
       ],
        year: "2024",
        medium: "Web Development", 
      role: "Technical Lead"
    };
  }
}

async function enhanceContent(item: ContentItem): Promise<ContentItem> {
  console.log(`Enhancing content for: ${item.name}`);

  // This section seems to be redundant as layout analysis is now handled in processItem
  // and the data isn't directly used here.
  // We will remove it to avoid confusion and potential bugs.

  let contentForPrompt = item.content || '';

  if (!contentForPrompt) {
    const mediaNames = (item.mediaFiles || []).map(f => f.name).join(', ');
    if (mediaNames) {
      contentForPrompt = `Project titled "${item.name}" with media files: ${mediaNames}`;
    } else {
      // No content and no media, just use the name
      contentForPrompt = `Project titled "${item.name}"`;
    }
  }

  const prompt = `
Given the following raw project content, please process it and return a clean JSON payload.

The JSON payload should have the following structure:
{
  "title": "string (extracted or improved project title)",
  "excerpt": "string (a compelling two-line excerpt)",
  "date": "string (date of the project, if available, in YYYY-MM-DD format)",
  "bodyBlocks": [
    {
      "type": "paragraph",
      "content": "string"
    },
    {
      "type": "image",
      "url": "string",
      "alt": "string (descriptive alt-text for accessibility)"
    },
    {
      "type": "video",
      "url": "string",
      "caption": "string (optional caption)"
    }
  ]
}

Here are the tasks to perform:
1. Extract or improve the project title.
2. Write a compelling two-line excerpt that summarizes the project.
3. Determine the best display order for all content blocks (paragraphs, images, GIFs, videos).
4. For all media (images, GIFs, videos), write descriptive alt-text or an optional caption.
5. Ensure the final output is a single, clean JSON object.

Here is the raw project content:
---
${contentForPrompt}
---

Please provide only the JSON object as the output.
`;

  try {
    const { textStream } = await streamText({
      model: openai('gpt-5'),
      prompt,
      temperature: 1,
    });

    let jsonString = '';
    for await (const delta of textStream) {
      jsonString += delta;
    }

    const cleanJsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    const enhancedData = JSON.parse(cleanJsonString);

    return {
      ...item,
      name: enhancedData.title || item.name,
      excerpt: enhancedData.excerpt || item.excerpt,
      // You can now also populate the body with structured content from the LLM
      // content: JSON.stringify(enhancedData.bodyBlocks),
    };
  } catch (error) {
    console.error(`Error enhancing content for ${item.name}:`, error);
    return {
      ...item,
      excerpt: item.content ? item.content.substring(0, 150).replace(/\\n/g, ' ') + '...' : `A project named ${item.name}.`,
    };
  }
}

async function processItem(item: ContentItem, manifest: AssetManifest, layoutCache: LayoutCache, seenDriveIds: Set<string>, errorLog: fs.WriteStream) {
  // First, recursively process all children so we have their data
  if (item.children) {
    for (const child of item.children) {
      await processItem(child, manifest, layoutCache, seenDriveIds, errorLog);
    }
  }

  // Now, handle the media files for the current item
  if (item.mediaFiles) {
    const processedMediaFiles: MediaFile[] = [];
    for (const mediaFile of item.mediaFiles) {
      seenDriveIds.add(mediaFile.id);
      const manifestEntry = manifest[mediaFile.id];
      const hasChanged = !manifestEntry || manifestEntry.driveModifiedTime !== mediaFile.modifiedTime;

      if (hasChanged) {
        console.log(`Syncing: ${item.path}/${mediaFile.name}`);
        try {
          const result = await uploadToCloudinary(mediaFile, item.path);
          manifest[mediaFile.id] = {
            status: 'success',
            cloudinaryPublicId: result.public_id,
            driveModifiedTime: mediaFile.modifiedTime,
            cloudinaryUrl: result.secure_url,
            width: result.width,
            height: result.height,
          };
          processedMediaFiles.push({
            ...mediaFile,
            webViewLink: result.secure_url,
            downloadLink: result.secure_url,
            thumbnailLink: result.secure_url,
            width: result.width,
            height: result.height,
          });
        } catch (error: any) {
          const errorMessage = error.message || 'Unknown error';
          console.error(`Failed to sync ${mediaFile.name}:`, errorMessage);
          errorLog.write(`File: ${item.path}/${mediaFile.name}\nReason: ${errorMessage}\n\n`);
          manifest[mediaFile.id] = {
            status: 'failed',
            driveModifiedTime: mediaFile.modifiedTime,
            failureReason: errorMessage,
          };
          // Don't add to processedMediaFiles as it failed
        }
      } else {
        if (manifestEntry.status === 'success') {
            // Unchanged and successful, use the URL from the manifest
            processedMediaFiles.push({
                ...mediaFile,
                webViewLink: manifestEntry.cloudinaryUrl,
                downloadLink: manifestEntry.cloudinaryUrl,
                thumbnailLink: manifestEntry.cloudinaryUrl,
                width: manifestEntry.width,
                height: manifestEntry.height,
            });
        } else {
            // Unchanged but failed previously. Skip upload and log.
            errorLog.write(`File (skipped): ${item.path}/${mediaFile.name}\nReason: ${manifestEntry.failureReason}\n\n`);
        }
      }
    }
    // We only include successfully processed files in the final content.json
    item.mediaFiles = processedMediaFiles;
    
    // After processing media, analyze layout
    if (item.mediaFiles.length > 0) {
        const currentSignature = createMediaSignature(item.mediaFiles);
        const cachedLayout = layoutCache[item.id];

        if (cachedLayout && cachedLayout.mediaSignature === currentSignature) {
          console.log(`Using cached layout for: ${item.name}`);
          item.mediaLayouts = cachedLayout.layouts;
        } else {
          console.log(`Generating new layout for: ${item.name}`);
          item.mediaLayouts = await analyzeMediaLayoutsWithLLM(item.mediaFiles);
          layoutCache[item.id] = {
            mediaSignature: currentSignature,
            layouts: item.mediaLayouts,
          };
        }
    }
  }
}

// Helper function to find the main doc and media files in a project
function extractProjectFiles(children: ContentItem[]) {
    const doc = children.find(c => c.type === 'page');
    const mediaFiles = children.filter(c => c.type !== 'page').flatMap(c => c.mediaFiles || []);
    return { doc, mediaFiles };
}

// This function needs to be defined to get the google drive file, it can be imported from driveApi.ts or defined here
async function getGoogleDriveFile(fileId: string): Promise<any> {
    const drive = (await import('../lib/driveApi')).drive;
    const res = await drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, webViewLink, thumbnailLink, modifiedTime, imageMediaMetadata, videoMediaMetadata',
    });
    return res.data;
}

async function main() {
  console.log('Starting content generation script...');

  // Set up the error log
  const errorLog = fs.createWriteStream(ERROR_LOG_FILE);
  errorLog.write(`Upload Error Log - ${new Date().toISOString()}\n\n`);


  const lastFetch = fs.existsSync(LAST_FETCH_FILE)
    ? fs.readFileSync(LAST_FETCH_FILE, 'utf-8')
    : null;

  console.log('Fetching portfolio data from Google Drive...');
  const portfolioData = await getPortfolioData(lastFetch);
  
  if (!portfolioData.root.children || portfolioData.root.children.length === 0) {
    console.log('No content found in Drive folder. Exiting.');
    return;
  }
  
  console.log('Syncing assets with Cloudinary...');
  const manifest = loadManifest();
  const layoutCache = loadLayoutCache();
  const projectCache = loadProjectCache();
  const seenDriveIds = new Set<string>();

  for (const item of portfolioData.root.children) {
    await processItem(item, manifest, layoutCache, seenDriveIds, errorLog);
  }

  // Pruning: Remove files from Cloudinary and manifest that are no longer in Drive
  const manifestIds = Object.keys(manifest);
  const deletedIds = manifestIds.filter(id => !seenDriveIds.has(id));

  const DANGEROUS_DELETE_THRESHOLD = 10;
  const forceDelete = process.argv.includes('--force-delete');

  if (deletedIds.length > DANGEROUS_DELETE_THRESHOLD && !forceDelete) {
    console.error(`\n\n--- SAFETY ABORT ---`);
    console.error(`The script is about to delete ${deletedIds.length} assets from Cloudinary. This seems unusually high.`);
    console.error(`This can happen if there is an error in the script or a problem connecting to Google Drive.`);
    console.error(`\nFiles that would be deleted:`);
    for (const id of deletedIds) {
      const entry = manifest[id];
      if (entry.status === 'success') {
        console.error(` - ${entry.cloudinaryPublicId}`);
      }
    }
    console.error(`\nIf this mass deletion is intentional, run the command again with the --force-delete flag.`);
    console.error(`Example: npm run build -- --force-delete`);
    process.exit(1); // Exit with an error code to stop the build
  }


  if (deletedIds.length > 0) {
    console.log(`Pruning ${deletedIds.length} deleted assets...`);
    for (const id of deletedIds) {
      const manifestEntry = manifest[id];
      if (manifestEntry.status === 'success') {
          try {
            await cloudinary.uploader.destroy(manifestEntry.cloudinaryPublicId);
            console.log(` - Deleted ${manifestEntry.cloudinaryPublicId} from Cloudinary`);
            delete manifest[id];
          } catch (error) {
            console.error(`Failed to delete ${manifestEntry.cloudinaryPublicId}:`, error);
          }
      } else {
        // If it was a failed entry, just remove it from the manifest
        delete manifest[id];
      }
    }
  }
  
  saveManifest(manifest);
  saveLayoutCache(layoutCache);
  saveProjectCache(projectCache);
  console.log('Asset manifest, layout cache, and project cache saved.');
  
  errorLog.end();
  // Check if error log has content other than the header
  if (fs.readFileSync(ERROR_LOG_FILE, 'utf-8').length > 50) {
      console.warn('\n--- !!! Some assets failed to upload. Check .upload-errors.log for details. !!! ---\n');
  } else {
      fs.unlinkSync(ERROR_LOG_FILE); // Clean up empty log file
  }

  // Generate zoom-level content structure
  console.log('Generating zoom-level content...');
  const projects = portfolioData.root.children?.filter(item => item.type === 'project') || [];
  
  const zoomProjects = [];
  for (const project of projects) {
    const currentSignature = createProjectSignature(project);
    const cachedProject = projectCache[project.id];

    if (cachedProject && cachedProject.projectSignature === currentSignature) {
      console.log(`Using cached project content for: ${project.name}`);
      zoomProjects.push(cachedProject.zoomContent);
    } else {
      console.log(`Generating new project content for: ${project.name}`);
      const projectZoomContent = await generateProjectZoomContent(project);
      zoomProjects.push(projectZoomContent);
      projectCache[project.id] = {
        projectSignature: currentSignature,
        zoomContent: projectZoomContent,
      };
    }
  }

  const introDoc = portfolioData.root.children?.find(item => item.name === '_intro' && item.type === 'page');
  let introContent: ParsedParagraph[] | null = null;
  if (introDoc && introDoc.content) {
    console.log('Parsing intro document...');
    introContent = parseIntroText(introDoc.content, projects);
  }

  const zoomContent = {
    siteHeader: "Hi, I'm Yotam — designer working with AI and the web.",
    projects: zoomProjects,
    introContent: introContent,
  };
  
  // Save zoom content separately for easy access
  const zoomContentPath = path.join(CONTENT_DIR, 'zoom-content.json');
  fs.writeFileSync(zoomContentPath, JSON.stringify(zoomContent, null, 2));
  console.log(`Zoom content saved to ${zoomContentPath}`);

  console.log('Saving content to JSON file...');
  const outputPath = path.join(CONTENT_DIR, 'content.json');
  fs.writeFileSync(outputPath, JSON.stringify(portfolioData, null, 2));
  fs.writeFileSync(LAST_FETCH_FILE, new Date().toISOString());

  console.log(`Content generation complete. Data saved to ${outputPath}`);
}

function parseIntroText(text: string, projects: ContentItem[]): ParsedParagraph[] {
  // Split by double line breaks to identify paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  return paragraphs.map(paragraphText => {
    const segments: ParsedContentSegment[] = [];
    let lastIndex = 0;
    
    // Updated Regex:
    // 1. [[Project Links]]
    // 2. [External Link] http...
    // 3. [Page Link]
    const regex = /\[\[(.*?)\]\]|\[(.*?)\]\s+(https?:\/\/[^\s]+|[\w.-]+@[\w.-]+\.\w+)|\[(.*?)\]/g;
    let match;

    while ((match = regex.exec(paragraphText)) !== null) {
      // Add the text segment before the current match
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: paragraphText.substring(lastIndex, match.index) });
      }

      const projectLinkName = match[1];
      const externalLinkName = match[2];
      const externalLinkUrl = match[3];
      const pageLinkName = match[4];

      if (projectLinkName) {
        // It's a project link like [[My Project]]
        const project = projects.find(p => p.name.trim().toLowerCase() === projectLinkName.trim().toLowerCase());
        if (project) {
          segments.push({ type: 'projectLink', text: projectLinkName, projectId: project.id });
        } else {
          console.warn(`Warning: Project link "[[${projectLinkName}]]" found in intro, but no matching project exists.`);
          segments.push({ type: 'text', content: match[0] });
        }
      } else if (externalLinkName && externalLinkUrl) {
        // It's an external or email link like [CV] http...
        if (externalLinkUrl.includes('@')) {
          segments.push({ type: 'emailLink', text: externalLinkName.trim(), email: externalLinkUrl });
        } else {
          segments.push({ type: 'externalLink', text: externalLinkName.trim(), url: externalLinkUrl });
        }
      } else if (pageLinkName) {
        // It's a page link like [About]
        const path = `/${pageLinkName.toLowerCase().replace(/\s+/g, '-')}`;
        segments.push({ type: 'pageLink', text: pageLinkName, path: path });
      }
      
      lastIndex = regex.lastIndex;
    }

    // Add any remaining text after the last match
    if (lastIndex < paragraphText.length) {
      segments.push({ type: 'text', content: paragraphText.substring(lastIndex) });
    }

    return segments;
  });
}

main().catch(console.error); 
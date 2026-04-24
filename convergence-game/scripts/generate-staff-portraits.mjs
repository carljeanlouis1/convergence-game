import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataPath = path.join(rootDir, "lib/game/data.ts");
const outputDir = path.join(rootDir, "public/staff");
const manifestPath = path.join(outputDir, "manifest.json");

const model = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image-preview";
const force = process.argv.includes("--force");
const apiKey = process.env.GEMINI_API_KEY?.trim();

const TRACK_STYLE = {
  foundation: "cool cyan foundation-model systems glow, abstract transformer lattice",
  alignment: "soft emerald safety overlays, interpretability maps, governance notes blurred in background",
  simulation: "amber scenario maps, city-scale model contours, economic forecast lines",
  robotics: "steel-blue robotics lab, articulated robot silhouettes, industrial precision lighting",
  biology: "teal bioinformatics lab, protein-folding visualization, clean wet-lab glass",
  materials: "warm copper materials lab, crystal lattice projections, fabrication bench atmosphere",
  quantum: "violet-blue quantum lab, cryostat glow, precise experimental instrumentation",
  space: "deep indigo orbital mission room, satellite telemetry arcs, launch-map lighting",
};

const readField = (block, name) => {
  const match = block.match(new RegExp(`${name}:\\s*\"([^\"]*)\"`));
  return match?.[1] ?? "";
};

const readNumber = (block, name) => {
  const match = block.match(new RegExp(`${name}:\\s*([0-9.]+)`));
  return match ? Number(match[1]) : 0;
};

const readBoolean = (block, name) => new RegExp(`${name}:\\s*true`).test(block);

const readTraits = (block) => {
  const match = block.match(/traits:\s*\[([^\]]*)\]/);
  if (!match) return [];

  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
};

const slugBlocks = (source) =>
  [...source.matchAll(/researcher\(\{([\s\S]*?)\n\s*\}\),/g)].map((match) => match[1]);

const buildPrompt = (researcher) => `
Create a square profile portrait for a fictional strategy-game staff roster.

Character:
- Name: ${researcher.name}
- Role: ${researcher.role}
- Location: ${researcher.location}
- Primary research lane: ${researcher.primaryTrack}
- Secondary lane: ${researcher.secondaryTrack || "none"}
- Traits: ${researcher.traits.join(", ")}
- Bio: ${researcher.bio}
- Strength pattern: research ${researcher.research}/10, execution ${researcher.execution}/10, leadership ${researcher.leadership}/10, ethics ${researcher.ethics}/10

Art direction:
- Premium near-future AI lab command-room portrait, fictional person, adult professional
- Bust portrait, 3/4 view, eye contact or focused off-camera expression
- Cinematic but readable at small UI size, sharp facial silhouette, clean rim light
- Outfit and props should imply the role and traits, not a superhero costume
- Background style: ${TRACK_STYLE[researcher.primaryTrack] ?? "near-future research lab"}
- Deep navy, graphite, cyan, amber, and white signal colors
- No text, no logos, no badges, no watermark, no UI labels
- Do not depict a real public figure or celebrity
`.trim();

const extractImagePart = (payload) => {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const imagePart = parts.find((part) => part?.inlineData?.data);
    if (imagePart?.inlineData?.data && imagePart.inlineData.mimeType) {
      return imagePart.inlineData;
    }
  }

  return null;
};

const generatePortrait = async (researcher) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt(researcher),
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["Image"],
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K",
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
  }

  const image = extractImagePart(await response.json());
  if (!image) {
    throw new Error("Gemini response did not include image data.");
  }

  return {
    bytes: Buffer.from(image.data, "base64"),
    mimeType: image.mimeType,
  };
};

const source = await readFile(dataPath, "utf8");
const researchers = slugBlocks(source).map((block) => ({
  id: readField(block, "id"),
  name: readField(block, "name"),
  role: readField(block, "role"),
  primaryTrack: readField(block, "primaryTrack"),
  secondaryTrack: readField(block, "secondaryTrack"),
  generalist: readBoolean(block, "generalist"),
  research: readNumber(block, "research"),
  execution: readNumber(block, "execution"),
  leadership: readNumber(block, "leadership"),
  ethics: readNumber(block, "ethics"),
  location: readField(block, "location"),
  traits: readTraits(block),
  bio: readField(block, "bio"),
}));

await mkdir(outputDir, { recursive: true });

const manifest = [];
for (const researcher of researchers) {
  const fileName = `${researcher.id}.jpg`;
  const filePath = path.join(outputDir, fileName);

  manifest.push({
    id: researcher.id,
    name: researcher.name,
    role: researcher.role,
    primaryTrack: researcher.primaryTrack,
    secondaryTrack: researcher.secondaryTrack || null,
    file: `/staff/${fileName}`,
  });

  if (!force && existsSync(filePath)) {
    console.log(`skip ${researcher.id}`);
    continue;
  }

  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY. Run with GEMINI_API_KEY=... npm run portraits:generate");
    process.exit(1);
  }

  console.log(`generate ${researcher.id} (${researcher.role})`);
  const image = await generatePortrait(researcher);
  await writeFile(filePath, image.bytes);

  // Keep requests gentle for local ad-hoc generation and free-tier rate limits.
  await new Promise((resolve) => setTimeout(resolve, 900));
}

await writeFile(manifestPath, `${JSON.stringify({ model, generatedAt: new Date().toISOString(), staff: manifest }, null, 2)}\n`);
console.log(`wrote ${manifest.length} staff portrait entries to ${path.relative(rootDir, manifestPath)}`);

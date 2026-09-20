import { createServerFn } from "@tanstack/react-start";
import type { ShapeAnalysis } from "@/components/meshpad/multiviewpanel";

type Point = { x: number; y: number };
type AnalyzeInput = { points: Point[]; imageData: string; canvasSize: number };
type GeminiContent = { type?: string; text?: string };
type GeminiStep = { type?: string; content?: GeminiContent[] };
type GeminiPayload = { steps?: GeminiStep[] };

const fallback = (points: Point[]): ShapeAnalysis => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return {
    source: "fallback",
    objectType: "unknown object",
    parts: [
      {
        name: "Main silhouette",
        kind: "extrude",
        scale: [1, 1, 1],
        position: [0, 0.8, 0],
        rotation: [0, 0, 0],
        color: "#6a8cff",
      },
    ],
    width,
    height,
    depth: Math.max(width * 0.55, 80),
    form: "extrude",
    confidence: 0.35,
    explanation: "Depth estimated from the front silhouette.",
  };
};

const responseSchema = {
  type: "object",
  properties: {
    objectType: { type: "string" },
    parts: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          kind: { type: "string", enum: ["cube", "sphere", "cylinder", "cone", "roof", "extrude"] },
          scale: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
          position: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
          rotation: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
          color: { type: "string" },
        },
        required: ["name", "kind", "scale", "position", "rotation", "color"],
      },
    },
    width: { type: "number" },
    height: { type: "number" },
    depth: { type: "number" },
    form: { type: "string", enum: ["extrude", "revolve"] },
    confidence: { type: "number" },
    explanation: { type: "string" },
  },
  required: [
    "objectType",
    "parts",
    "width",
    "height",
    "depth",
    "form",
    "confidence",
    "explanation",
  ],
};

export const analyzeShape = createServerFn({ method: "POST" })
  .validator((data: AnalyzeInput) => data)
  .handler(async ({ data }): Promise<ShapeAnalysis> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      return {
        ...fallback(data.points),
        aiError: "GEMINI_API_KEY is not available to the server.",
      };
    }

    const imageData = data.imageData.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
    if (!imageData) {
      return { ...fallback(data.points), aiError: "The drawing image could not be prepared." };
    }

    try {
      const result = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
          "Api-Revision": "2026-05-20",
        },
        body: JSON.stringify({
          model: process.env["GEMINI_SHAPE_MODEL"] ?? "gemini-3.8-flash",
          store: false,
          input: [
            {
              type: "text",
              text: [
                "Identify what this rough drawing represents, such as a house, car, tree, person, animal, cup, toy, or another object.",
                "Analyze the actual drawing image, not just its contour. Infer width, height, and plausible depth in the same pixel units.",
                "Return a simple editable 3D plan made from 1 to 8 parts. Use cubes for bodies/buildings, cones for roofs, cylinders for trunks/poles, spheres for round parts, and extrude for the main silhouette.",
                "Use revolve only when the object strongly suggests rotational symmetry.",
                "Return only the requested JSON object.",
                `Canvas size: ${data.canvasSize}.`,
                `Outline coordinates for scale reference: ${JSON.stringify(data.points)}`,
              ].join("\n"),
            },
            { type: "image", data: imageData[2], mime_type: imageData[1] },
          ],
          response_format: { type: "text", mime_type: "application/json", schema: responseSchema },
        }),
      });

      if (!result.ok) throw new Error(await result.text());
      const payload = (await result.json()) as GeminiPayload;
      const text = payload.steps
        ?.filter((step) => step.type === "model_output")
        .flatMap((step) => step.content ?? [])
        .find((content) => content.type === "text")?.text;
      if (!text) throw new Error("Gemini returned no analysis.");
      return { ...(JSON.parse(text) as ShapeAnalysis), source: "gemini" };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gemini returned an invalid response.";
      return { ...fallback(data.points), aiError: message.slice(0, 240) };
    }
  });

type Point = { x: number; y: number };
type RequestBody = { points?: Point[]; imageData?: string; canvasSize?: number };
type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = { status: (code: number) => { json: (payload: unknown) => ApiResponse } };
type GeminiContent = { type?: string; text?: string };
type GeminiStep = { type?: string; content?: GeminiContent[] };
type GeminiPayload = { steps?: GeminiStep[] };

const fallback = (points: Point[]) => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return {
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
    objectType: {
      type: "string",
      description: "What the drawing represents, such as house, car, tree, or toy.",
    },
    parts: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      description: "Simple editable 3D parts that together represent the drawn object.",
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

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });

  const body = request.body as RequestBody;
  const points = body.points ?? [];
  if (points.length < 3) {
    return response.status(400).json({ error: "At least three points are required." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return response.status(200).json(fallback(points));

  const imageData = body.imageData?.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
  if (!imageData) return response.status(400).json({ error: "A PNG or JPEG drawing is required." });

  try {
    const result = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "Api-Revision": "2026-05-20",
      },
      body: JSON.stringify({
        model: process.env.GEMINI_SHAPE_MODEL ?? "gemini-3.8-flash",
        // Do not store one-off free-tier analyses as conversation history.
        store: false,
        input: [
          {
            type: "text",
            text: [
              "Identify what this rough drawing represents, such as a house, car, tree, person, animal, cup, toy, or another object.",
              "Analyze the actual drawing image, not just its contour. Infer width, height, and plausible depth in the same pixel units.",
              "Use revolve only when the object strongly suggests rotational symmetry; otherwise use extrude.",
              "Return a simple editable 3D plan made from 1 to 8 parts. Use cubes for bodies/buildings, cones for roofs, cylinders for trunks/poles, spheres for round parts, and extrude for the main silhouette.",
              "Return only the requested JSON object.",
              `Canvas size: ${body.canvasSize ?? 600}.`,
              `Outline coordinates for scale reference: ${JSON.stringify(points)}`,
            ].join("\n"),
          },
          { type: "image", data: imageData[2], mime_type: imageData[1] },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: responseSchema,
        },
      }),
    });

    if (!result.ok) throw new Error(await result.text());
    const payload = (await result.json()) as GeminiPayload;
    const text = payload.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .find((content) => content.type === "text")?.text;
    if (!text) throw new Error("Gemini returned no analysis.");
    return response.status(200).json(JSON.parse(text));
  } catch {
    return response.status(200).json(fallback(points));
  }
}

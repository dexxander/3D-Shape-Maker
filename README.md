# Shape Maker Studio #

Build a lightweight, responsive browser-based 3D creation app called MeshPad Lite.

Stack: React + TypeScript + Vite, Three.js, Tailwind CSS, and an optional server-side AI analysis endpoint. Deployable to Vercel.

Core workflow:

1. Provide a 2D drawing canvas with red drawing, white eraser, clear, undo, and redo.

2. Let users draw a closed outline.

3. Ask AI to estimate the missing depth and whether the form should be extruded or revolved, then convert the outline into an editable 3D mesh using Three.js.

4. Show the mesh in a 3D viewer with orbit, pan, zoom, grid, lighting, wireframe toggle, and reset camera.

5. Allow adding cube, sphere, cylinder, cone, and custom extruded shapes.

6. Allow selecting objects and moving, rotating, scaling, duplicating, and deleting them.

7. Add undo/redo for mesh edits.

8. Export the scene as OBJ and STL, with download buttons.

9. Add “New Project”, “Clear All”, and “Save Project” controls.

10. Store projects locally in localStorage. Structure the code so Supabase authentication, database, and storage can be added later.

Design:

- Friendly, polished, family-oriented interface.

- Two-column desktop layout: drawing tools on the left, 3D viewer on the right.

- Mobile layout should stack the panels.

- Use clear labels, large buttons, helpful empty states, and accessible keyboard controls.

- Include a short onboarding panel explaining: Draw → AI analyze → Build 3D → Edit → Export.

Implementation:

- Keep mesh generation client-side; keep the AI key server-side in `GEMINI_API_KEY`.

- Validate that outlines are closed and show a helpful error if they are not.

- Use modular components and clean TypeScript types.

- Avoid unnecessary dependencies.

- Add sample starter shapes so the app is usable immediately.

- Make the first version fully functional before adding visual polish.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploy to Vercel

Import this repository into Vercel. The included `vercel.json` enables TanStack Start framework detection and Nitro generates the Vercel server output during `npm run build`.

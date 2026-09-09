const STEPS = [
  { title: "Sketch", text: "Choose ADD or DEL and draw an edit stroke." },
  { title: "Build", text: "Each ADD stroke contributes new 3D mesh parts." },
  { title: "Refine", text: "Use DEL strokes and repeat edits to shape the object." },
  { title: "Export", text: "Download your scene as an OBJ or STL file." },
];

export function Onboarding({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section
      aria-label="How MeshPad works"
      className="rounded-3xl border border-border bg-gradient-to-br from-accent/60 to-card p-4 shadow-soft sm:p-5"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="font-display truncate text-lg">How it works</h2>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
        >
          Got it
        </button>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl bg-background/70 p-3">
            <p className="text-xs font-bold text-primary">STEP {i + 1}</p>
            <p className="font-display text-base">{s.title}</p>
            <p className="text-sm text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

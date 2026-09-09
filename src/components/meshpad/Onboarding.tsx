const STEPS = [
  { title: "Imagine", text: "Children sketch an idea and give it a name." },
  { title: "Create", text: "Turn the sketch into a playful 3D object together." },
  { title: "Print", text: "Export the creation and bring it into the real world." },
  { title: "Understand", text: "Use the object to open a family conversation." },
];

export function Onboarding({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section
      aria-label="How MeshPad works"
      className="rounded-3xl border border-border bg-gradient-to-br from-accent/60 to-card p-4 shadow-soft sm:p-5"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="font-display truncate text-lg">From imagination to creation</h2>
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
            <p className="text-xs font-bold text-primary">
              {i + 1}. {s.title.toUpperCase()}
            </p>
            <p className="font-display text-base">{s.title}</p>
            <p className="text-sm text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

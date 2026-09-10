const STEPS = [
  { title: "Imagine", text: "Children sketch an idea and give it a name." },
  { title: "Build", text: "Turn the idea into a colorful toy for the room." },
  { title: "Play", text: "Move it around the soft-floor playground together." },
  { title: "Share", text: "Use the scene to open a family conversation." },
];

export function Onboarding({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section
      aria-label="How MeshPad works"
      className="rounded-3xl border border-border bg-gradient-to-br from-accent/60 to-card p-4 shadow-soft sm:p-5"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="font-display truncate text-lg">From imagination to playtime</h2>
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

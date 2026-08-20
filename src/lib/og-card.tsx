import type { Bird, Chirp, Flock } from "@/lib/types";

function EyePair({ looking = 0 }: { looking?: number }) {
  const shift = looking * 4;
  return (
    <div
      style={{
        display: "flex",
        gap: 18,
        transform: `translate(${shift}px, ${Math.abs(looking)}px)`,
      }}
    >
      <div
        style={{
          width: 18,
          height: 40,
          borderRadius: 999,
          backgroundColor: "#0A0B0D",
          transform: "rotate(-18deg)",
        }}
      />
      <div
        style={{
          width: 18,
          height: 40,
          borderRadius: 999,
          backgroundColor: "#0A0B0D",
          transform: "rotate(-18deg)",
        }}
      />
    </div>
  );
}

export function OgCardMarkup({
  flock,
  birds,
  chirp,
  host,
}: {
  flock: Flock;
  birds: Bird[];
  chirp: Chirp | null;
  host: string;
}) {
  const shown = birds.slice(0, 6);
  const extra = birds.length - shown.length;
  const latest = chirp
    ? chirp.text.length > 88
      ? `${chirp.text.slice(0, 85)}…`
      : chirp.text
    : "No chirps yet";

  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0A0B0D",
        color: "#F3F5F6",
        padding: "40px 48px 36px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", width: 28, height: 28, flexWrap: "wrap", gap: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#C6F84E" }} />
            <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#FF7A5C" }} />
            <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#4E9BFF" }} />
            <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#2FD98A" }} />
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "IBM Plex Sans",
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "-0.04em",
            }}
          >
            flok
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "IBM Plex Sans",
            fontSize: 22,
            color: "#98A2AD",
          }}
        >
          @{flock.handle}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontFamily: "Instrument Serif",
          fontSize: 56,
          lineHeight: 1.02,
          letterSpacing: "-0.03em",
          marginTop: 22,
        }}
      >
        {flock.title}
      </div>

      <div
        style={{
          display: "flex",
          gap: 14,
          marginTop: 28,
        }}
      >
        {shown.map((bird, i) => (
          <div
            key={bird.id}
            style={{
              display: "flex",
              flexDirection: "column",
              width: 168,
              height: 168,
              borderRadius: 38,
              backgroundColor: bird.color,
              padding: "36px 28px 16px",
              justifyContent: "space-between",
              boxShadow: "inset 0 -18px 28px rgba(0,0,0,0.16)",
            }}
          >
            <EyePair looking={(i % 3) - 1} />
            <div
              style={{
                display: "flex",
                fontFamily: "IBM Plex Sans",
                fontSize: 20,
                fontWeight: 500,
                color: "#0A0B0D",
              }}
            >
              {bird.name}
            </div>
          </div>
        ))}
        {extra > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              fontFamily: "IBM Plex Sans",
              fontSize: 20,
              color: "#5C646E",
              paddingBottom: 12,
            }}
          >
            {`+${extra}`}
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          gap: 14,
          borderTop: "1px solid #20242B",
          paddingTop: 18,
          color: "#F3F5F6",
          fontSize: 22,
          fontFamily: "IBM Plex Sans",
        }}
      >
        <div style={{ display: "flex", color: "#5C646E" }}>{host}</div>
        <div style={{ display: "flex" }}>{latest}</div>
      </div>
    </div>
  );
}

import type { ClusterFace, Flock, OgCluster } from "@/lib/types";

function EyePair({ looking = 0, closed = false }: { looking?: number; closed?: boolean }) {
  const shift = looking * 2;
  if (closed) {
    return (
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ width: 14, height: 4, borderRadius: 999, backgroundColor: "#0A0B0D" }} />
        <div style={{ width: 14, height: 4, borderRadius: 999, backgroundColor: "#0A0B0D" }} />
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        transform: `translate(${shift}px, ${Math.abs(looking)}px)`,
      }}
    >
      <div
        style={{
          width: 10,
          height: 22,
          borderRadius: 999,
          backgroundColor: "#0A0B0D",
          transform: "rotate(-18deg)",
        }}
      />
      <div
        style={{
          width: 10,
          height: 22,
          borderRadius: 999,
          backgroundColor: "#0A0B0D",
          transform: "rotate(-18deg)",
        }}
      />
    </div>
  );
}

const STUB: ClusterFace = { name: "", color: "#16191F", state: "offline" };

function OgClusterTile({ cluster }: { cluster: OgCluster }) {
  const faces = [...cluster.faces];
  while (faces.length < 4) faces.push(STUB);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 248,
        backgroundColor: "#111318",
        borderRadius: 28,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, width: 220 }}>
        {faces.slice(0, 4).map((face, i) => (
          <div
            key={`${cluster.name}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 107,
              height: 107,
              borderRadius: 24,
              backgroundColor: face.color,
              opacity: face.name ? 1 : 0.55,
              boxShadow:
                face.state === "attested"
                  ? "0 0 0 2px #C6F84E"
                  : face.state === "working"
                    ? "0 0 0 1px rgba(198,248,78,0.45)"
                    : face.state === "denied"
                      ? "0 0 0 1px rgba(247,179,61,0.55)"
                      : face.state === "bound"
                        ? "0 0 0 2px rgba(92,100,110,0.7)"
                        : undefined,
            }}
          >
            <EyePair
              looking={face.state === "racing" ? 1 : (i % 3) - 1}
              closed={!face.name || face.state === "offline" || face.state === "rolled_back"}
            />
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 12,
          fontFamily: "IBM Plex Sans",
          fontSize: 22,
          fontWeight: 500,
          color: "#F3F5F6",
        }}
      >
        {cluster.name}
      </div>
    </div>
  );
}

export function OgCardMarkup({
  flock,
  clusters,
  nodeCount,
  host,
}: {
  flock: Flock;
  clusters: OgCluster[];
  nodeCount: number;
  host: string;
}) {
  const shown = clusters.slice(0, 4);
  const extra = clusters.length - shown.length;
  const subtitle = `${clusters.length} ${clusters.length === 1 ? "cluster" : "clusters"} · ${nodeCount} ${nodeCount === 1 ? "node" : "nodes"} · SPX404`;

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
          marginTop: 18,
        }}
      >
        {flock.title}
      </div>

      <div
        style={{
          display: "flex",
          fontFamily: "IBM Plex Sans",
          fontSize: 22,
          color: "#98A2AD",
          marginTop: 8,
        }}
      >
        {subtitle}
      </div>

      <div
        style={{
          display: "flex",
          gap: 14,
          marginTop: 22,
        }}
      >
        {shown.map((cluster) => (
          <OgClusterTile key={cluster.name} cluster={cluster} />
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
          color: "#5C646E",
          fontSize: 22,
          fontFamily: "IBM Plex Sans",
        }}
      >
        <div style={{ display: "flex" }}>{host}</div>
      </div>
    </div>
  );
}

import { ImageResponse } from "next/og";

export const alt = "CineGenius — Marktplatz für Film, Social Media & Fotografie";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0d0033 0%, #0a1a3a 40%, #003322 80%, #0d1a00 100%)",
          padding: "70px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Vivid lime glow top-right */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -60,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(194,241,53,0.55) 0%, rgba(194,241,53,0.15) 40%, transparent 70%)",
            display: "flex",
          }}
        />
        {/* Cyan glow center-right */}
        <div
          style={{
            position: "absolute",
            top: 100,
            right: 200,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,220,255,0.3) 0%, transparent 65%)",
            display: "flex",
          }}
        />
        {/* Magenta glow bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: -120,
            left: -80,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(220,50,180,0.45) 0%, rgba(120,0,200,0.2) 40%, transparent 70%)",
            display: "flex",
          }}
        />
        {/* Orange accent glow bottom-center */}
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: "35%",
            width: 400,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,140,0,0.3) 0%, transparent 65%)",
            display: "flex",
          }}
        />

        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: "#C2F135",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 900,
              color: "#0A0A0A",
            }}
          >
            ▶
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: "-0.5px" }}>
            <span style={{ color: "#FFFFFF" }}>Cine</span>
            <span style={{ color: "#C2F135" }}>Genius</span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <span
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: "#FFFFFF",
                lineHeight: 1.05,
                letterSpacing: "-2px",
              }}
            >
              Locations, Crew
            </span>
            <div style={{ display: "flex" }}>
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 800,
                  color: "#C2F135",
                  lineHeight: 1.05,
                  letterSpacing: "-2px",
                }}
              >
                &amp; Equipment
              </span>
            </div>
          </div>

          {/* Subtitle */}
          <span style={{ fontSize: 26, color: "rgba(255,255,255,0.7)", fontWeight: 400 }}>
            Der Marktplatz für Film, Social Media &amp; Fotografie im DACH-Raum.
          </span>

          {/* Category pills */}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {[
              { label: "Locations", color: "#C2F135" },
              { label: "Filmcrew", color: "#00DCFF" },
              { label: "Equipment", color: "#FF8C00" },
              { label: "Jobs", color: "#DC32B4" },
              { label: "Tiere", color: "#C2F135" },
            ].map(({ label, color }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "8px 20px",
                  border: `1.5px solid ${color}60`,
                  borderRadius: 100,
                  color,
                  fontSize: 18,
                  fontWeight: 600,
                  background: `${color}12`,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

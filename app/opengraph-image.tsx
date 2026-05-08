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
          background: "linear-gradient(135deg, #0A0A0A 0%, #0f1a05 50%, #0A0A0A 100%)",
          padding: "70px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative glow circles */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(194,241,53,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -150,
            left: -100,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(194,241,53,0.07) 0%, transparent 70%)",
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
          <span style={{ fontSize: 40, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.5px" }}>
            Cine<span style={{ color: "#C2F135" }}>Genius</span>
          </span>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "#FFFFFF",
              lineHeight: 1.05,
              letterSpacing: "-2px",
            }}
          >
            Locations, Crew
            <br />
            <span style={{ color: "#C2F135" }}>&amp; Equipment</span>
          </div>

          <div style={{ fontSize: 26, color: "rgba(255,255,255,0.55)", fontWeight: 400, lineHeight: 1.4 }}>
            Der Marktplatz für Film, Social Media &amp; Fotografie im DACH-Raum.
          </div>

          {/* Category pills */}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {["Locations", "Filmcrew", "Equipment", "Jobs", "Tiere"].map((label) => (
              <div
                key={label}
                style={{
                  padding: "8px 20px",
                  border: "1px solid rgba(194,241,53,0.35)",
                  borderRadius: 100,
                  color: "#C2F135",
                  fontSize: 18,
                  fontWeight: 500,
                  display: "flex",
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

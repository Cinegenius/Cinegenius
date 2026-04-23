import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CineGenius — Marktplatz für Film, Social Media & Fotografie";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const heroUrl = new URL("/hero-bg.jpg", process.env.NEXT_PUBLIC_APP_URL ?? "https://cinegenius.co").toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#0A0A0A",
        }}
      >
        {/* Hero background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 40%",
            opacity: 0.55,
          }}
        />

        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.85) 100%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: "0 80px 70px",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div
              style={{
                width: 44,
                height: 44,
                background: "#C2F135",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 900,
                color: "#0A0A0A",
              }}
            >
              ▶
            </div>
            <span style={{ fontSize: 36, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.5px" }}>
              Cine<span style={{ color: "#C2F135" }}>Genius</span>
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.1,
              letterSpacing: "-1px",
              marginBottom: 18,
            }}
          >
            Locations, Crew & Equipment
          </div>

          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.6)", fontWeight: 400 }}>
            Der Marktplatz für Film, Social Media & Fotografie im DACH-Raum.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

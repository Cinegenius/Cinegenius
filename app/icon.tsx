import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          background: "#0A0A0A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
        }}
      >
        {/* Chevron › — two rotated bars forming the CineGenius mark */}
        <div style={{ position: "relative", width: 34, height: 36, display: "flex" }}>
          {/* Top arm */}
          <div
            style={{
              position: "absolute",
              width: 22,
              height: 5,
              background: "#C2F135",
              borderRadius: 3,
              top: 8,
              left: 4,
              transform: "rotate(-38deg)",
              transformOrigin: "right center",
            }}
          />
          {/* Bottom arm */}
          <div
            style={{
              position: "absolute",
              width: 22,
              height: 5,
              background: "#C2F135",
              borderRadius: 3,
              top: 23,
              left: 4,
              transform: "rotate(38deg)",
              transformOrigin: "right center",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}

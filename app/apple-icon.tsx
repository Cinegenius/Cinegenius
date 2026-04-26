import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#0A0A0A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
        }}
      >
        <div style={{ position: "relative", width: 96, height: 104, display: "flex" }}>
          <div
            style={{
              position: "absolute",
              width: 64,
              height: 14,
              background: "#C2F135",
              borderRadius: 7,
              top: 22,
              left: 10,
              transform: "rotate(-38deg)",
              transformOrigin: "right center",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 64,
              height: 14,
              background: "#C2F135",
              borderRadius: 7,
              top: 66,
              left: 10,
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

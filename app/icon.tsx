import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: "#0A0A0A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 32,
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: "#C2F135",
            lineHeight: 1,
          }}
        >
          ▶
        </div>
      </div>
    ),
    { ...size }
  );
}

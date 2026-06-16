import { ImageResponse } from "next/og";

export const alt = "RK8:// — every cartridge ever mounted";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social share card — the wordmark on near-black, yellow accent edge.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0a0c",
          fontFamily: "monospace",
          borderTop: "8px solid #FCEE0A",
        }}
      >
        <div style={{ color: "#8a8a95", fontSize: 28, letterSpacing: 4 }}>
          // BROWSER-NATIVE RETRO GAMING
        </div>
        <div style={{ color: "#FCEE0A", fontSize: 150, fontWeight: 700 }}>
          RK8://
        </div>
        <div style={{ color: "#f5f5f7", fontSize: 36 }}>
          every cartridge ever mounted
        </div>
        <div style={{ color: "#00F0FF", fontSize: 24, marginTop: 24 }}>
          38 systems · play instantly · no installs
        </div>
      </div>
    ),
    size,
  );
}

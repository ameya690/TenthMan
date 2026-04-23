import { colors, fonts } from "../theme";
import { Tag, EvidenceTag } from "./ui";

export default function AdversaryCard({ data }) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.adversary}30`,
        borderRadius: 10,
        padding: 20,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: colors.adversary }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚔</span>
          <Tag color={colors.adversary}>Tenth Man — Adversary</Tag>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: colors.textDim, fontFamily: fonts.mono }}>SELF-RATED</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: fonts.mono,
              color: colors.adversary,
              background: colors.adversaryDim,
              padding: "2px 8px",
              borderRadius: 8,
            }}
          >
            {data.self_rated_strength}/100
          </span>
        </div>
      </div>

      {/* Counter-argument */}
      <p style={{ color: colors.text, fontSize: 13, lineHeight: 1.65, margin: "0 0 14px" }}>
        {data.counter_argument}
      </p>

      {/* Evidence points */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {data.evidence_points?.map((ep, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
            <span style={{ color: colors.adversary, flexShrink: 0, marginTop: 1 }}>→</span>
            <span style={{ color: colors.textSoft, flex: 1 }}>
              {typeof ep === "string" ? ep : ep.point}
            </span>
            {typeof ep !== "string" && ep.type && <EvidenceTag type={ep.type} />}
          </div>
        ))}
      </div>

      {/* Assumption attack */}
      {data.assumption_attack && (
        <div style={{ background: colors.adversaryDim, borderRadius: 6, padding: "8px 12px", fontSize: 11.5, color: colors.adversary, marginBottom: 8 }}>
          <strong>Assumption under attack:</strong> {data.assumption_attack}
        </div>
      )}

      {/* Counter-example */}
      {data.counter_example && (
        <div style={{ background: colors.surfaceRaised, borderRadius: 6, padding: "8px 12px", fontSize: 11.5, color: colors.textSoft }}>
          <strong style={{ color: colors.text }}>Counter-example:</strong> {data.counter_example}
        </div>
      )}
    </div>
  );
}

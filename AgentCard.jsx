import { colors, fonts } from "../theme";
import { Tag, ConfBar, EvidenceTag } from "./ui";

export default function AgentCard({ agent, profile, phase = "initial" }) {
  const verdict = phase === "final" ? agent.final_verdict : agent.verdict;
  const isSupport = verdict === "SUPPORT";
  const color = isSupport ? colors.support : colors.oppose;

  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: 18,
        flex: 1,
        minWidth: 180,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: profile.color }} />

      {/* Header: persona + verdict */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: profile.color, fontSize: 14 }}>{profile.icon}</span>
          <Tag color={profile.color}>{profile.name}</Tag>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {phase === "final" && agent.changed && (
            <Tag color={colors.flip} bg={colors.flipDim}>Flipped</Tag>
          )}
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: fonts.mono,
              color,
              background: isSupport ? colors.supportDim : colors.opposeDim,
              padding: "3px 9px",
              borderRadius: 12,
            }}
          >
            {verdict}
          </span>
        </div>
      </div>

      {/* Confidence bar */}
      <ConfBar
        value={agent.confidence}
        color={color}
        prev={phase === "final" ? agent.prevConf : undefined}
      />

      {/* Reasoning */}
      <p style={{ color: colors.textSoft, fontSize: 12, lineHeight: 1.6, margin: "8px 0" }}>
        {agent.reasoning}
      </p>

      {/* Evidence type + assumption (initial phase) */}
      {phase === "initial" && agent.evidence_type && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
          <EvidenceTag type={agent.evidence_type} />
          {agent.key_assumption && (
            <span style={{ fontSize: 10, color: colors.textDim, fontStyle: "italic" }}>
              Assumes: {agent.key_assumption.length > 60 ? agent.key_assumption.slice(0, 60) + "…" : agent.key_assumption}
            </span>
          )}
        </div>
      )}

      {/* Change trigger (final phase) */}
      {phase === "final" && agent.change_trigger && (
        <div style={{ marginTop: 8, padding: "6px 10px", background: colors.flipDim, borderRadius: 6, fontSize: 11, color: colors.flip }}>
          Trigger: {agent.change_trigger}
        </div>
      )}

      {/* Uncertainty factors (final phase) */}
      {phase === "final" && agent.uncertainty_factors?.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {agent.uncertainty_factors.map((f, i) => (
            <span key={i} style={{ fontSize: 9, color: colors.textDim, background: colors.surfaceRaised, padding: "2px 6px", borderRadius: 4 }}>
              ⚠ {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

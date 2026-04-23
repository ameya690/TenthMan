import { colors, fonts } from "../theme";
import { Tag, MetricCard, EvidenceTag } from "./ui";

export default function MetricsPanel({ metrics, history }) {
  if (!metrics) return null;
  const m = metrics;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Tag color={colors.textSoft}>Framework Effectiveness Dashboard</Tag>
      </div>

      {/* Primary metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 12 }}>
        <MetricCard label="Total Runs" value={m.totalRuns} sub="experiments completed" />
        <MetricCard label="Consensus Rate" value={`${Math.round(m.initialConsensusRate * 100)}%`} sub={`${m.initialConsensus}/${m.totalRuns} unanimous`} />
        <MetricCard label="Flip Rate" value={`${Math.round(m.flipRate * 100)}%`} sub={`${m.totalAgentFlips} agent flips`} color={colors.adversary} />
        <MetricCard label="Verdict Reversals" value={`${Math.round(m.verdictReversalRate * 100)}%`} sub={`${m.verdictReversals} overturned`} color={colors.flip} />
        <MetricCard
          label="Sycophancy Rate"
          value={`${Math.round(m.sycophancyRate * 100)}%`}
          sub="flips despite weak adversary"
          color={m.sycophancyRate > 0.3 ? colors.oppose : colors.support}
        />
        <MetricCard
          label="Avg Conf Δ"
          value={`${m.avgConfDrop > 0 ? "-" : "+"}${Math.abs(m.avgConfDrop).toFixed(1)}`}
          sub="post-adversary shift"
          color={m.avgConfDrop > 0 ? colors.adversary : colors.support}
        />
      </div>

      {/* Accuracy & Brier scores (only when ground truth provided) */}
      {m.runsWithGT > 0 && (
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <Tag color={colors.accent}>Accuracy & Calibration ({m.runsWithGT} runs with ground truth)</Tag>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: colors.textDim, fontFamily: fonts.mono, marginBottom: 4 }}>ACCURACY (INITIAL → FINAL)</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.mono }}>
                <span style={{ color: colors.textSoft }}>{Math.round(m.accuracyInitial * 100)}%</span>
                <span style={{ color: colors.textDim, margin: "0 6px" }}>→</span>
                <span style={{ color: m.accuracyFinal >= m.accuracyInitial ? colors.support : colors.oppose }}>
                  {Math.round(m.accuracyFinal * 100)}%
                </span>
              </div>
              <div style={{ fontSize: 9, color: colors.textDim, marginTop: 2 }}>
                {m.accuracyFinal > m.accuracyInitial
                  ? "Adversary improved accuracy ✓"
                  : m.accuracyFinal === m.accuracyInitial
                  ? "No change in accuracy"
                  : "⚠ Adversary degraded accuracy"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: colors.textDim, fontFamily: fonts.mono, marginBottom: 4 }}>BRIER SCORE (LOWER = BETTER)</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.mono }}>
                <span style={{ color: colors.textSoft }}>{m.avgBrierInitial?.toFixed(3)}</span>
                <span style={{ color: colors.textDim, margin: "0 6px" }}>→</span>
                <span style={{ color: m.brierImproved ? colors.support : colors.oppose }}>
                  {m.avgBrierFinal?.toFixed(3)}
                </span>
              </div>
              <div style={{ fontSize: 9, color: colors.textDim, marginTop: 2 }}>
                {m.brierImproved ? "Better calibrated after debate ✓" : "⚠ Calibration worsened"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evidence diversity */}
      {Object.keys(m.evidenceDistribution).length > 0 && (
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <Tag color={colors.textSoft}>Evidence Diversity</Tag>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {Object.entries(m.evidenceDistribution).map(([type, count]) => {
              const total = Object.values(m.evidenceDistribution).reduce((a, b) => a + b, 0);
              const pct = Math.round((count / total) * 100);
              return (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: 6, background: colors.surfaceRaised, padding: "6px 10px", borderRadius: 6 }}>
                  <EvidenceTag type={type} />
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: fonts.mono, color: colors.text }}>{pct}%</span>
                  <span style={{ fontSize: 10, color: colors.textDim }}>({count})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Run log table */}
      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
        <div
          style={{
            padding: "10px 14px",
            borderBottom: `1px solid ${colors.border}`,
            fontSize: 9,
            color: colors.textDim,
            fontFamily: fonts.mono,
            letterSpacing: 1,
            textTransform: "uppercase",
            display: "grid",
            gridTemplateColumns: "1fr 70px 60px 70px 60px 60px",
            gap: 6,
          }}
        >
          <span>Claim</span>
          <span>Initial</span>
          <span>Adv.</span>
          <span>Final</span>
          <span>Δ Conf</span>
          <span>Result</span>
        </div>
        {history.map((h, i) => (
          <div
            key={i}
            style={{
              padding: "9px 14px",
              borderBottom: i < history.length - 1 ? `1px solid ${colors.border}` : "none",
              fontSize: 11,
              display: "grid",
              gridTemplateColumns: "1fr 70px 60px 70px 60px 60px",
              gap: 6,
              alignItems: "center",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: colors.textSoft, fontSize: 10 }}>
              {h.claim}
            </span>
            <span style={{ color: h.initialMajority === "SUPPORT" ? colors.support : colors.oppose, fontSize: 10, fontWeight: 600 }}>
              {h.initialMajority}
            </span>
            <span style={{ color: colors.adversary, fontFamily: fonts.mono, fontSize: 10 }}>
              {h.adversaryStrength}/100
            </span>
            <span style={{ color: h.finalMajority === "SUPPORT" ? colors.support : colors.oppose, fontSize: 10, fontWeight: 600 }}>
              {h.finalMajority}
            </span>
            <span style={{ fontFamily: fonts.mono, fontSize: 10, color: h.avgInitialConf - h.avgFinalConf > 0 ? colors.adversary : colors.support }}>
              {h.avgInitialConf - h.avgFinalConf > 0 ? "-" : "+"}
              {Math.abs(h.avgInitialConf - h.avgFinalConf).toFixed(0)}
            </span>
            <span>
              {h.majorityReversed ? (
                <Tag color={colors.flip} bg={colors.flipDim}>Reversed</Tag>
              ) : (
                <span style={{ color: colors.textDim, fontSize: 9 }}>held</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

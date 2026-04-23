import { useState, useCallback, useMemo } from "react";
import { colors, fonts } from "./theme";
import { AGENT_PROFILES, PROMPTS, buildAdversaryInput, buildFinalVoteInput } from "./agents";
import { apiCall, PROVIDERS, DEFAULT_CONFIG } from "./api";
import { calcMetrics, buildHistoryRecord } from "./metrics";
import { Tag, PhaseBar } from "./components/ui";
import AgentCard from "./components/AgentCard";
import AdversaryCard from "./components/AdversaryCard";
import MetricsPanel from "./components/MetricsPanel";
import ConfigPanel from "./components/ConfigPanel";

const PHASES = ["Setup", "Research", "Challenge", "Vote", "Results"];

export default function App() {
  const [claim, setClaim] = useState("");
  const [groundTruth, setGroundTruth] = useState("");
  const [phase, setPhase] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [agents, setAgents] = useState([null, null]);
  const [adversary, setAdversary] = useState(null);
  const [finalAgents, setFinalAgents] = useState([null, null]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const metrics = useMemo(() => calcMetrics(history), [history]);
  const adversarySupportsSearch = PROVIDERS[config.adversary.provider]?.supportsSearch;

  const reset = () => {
    setPhase(0);
    setAgents([null, null]);
    setAdversary(null);
    setFinalAgents([null, null]);
    setError(null);
    setClaim("");
    setGroundTruth("");
  };

  const run = useCallback(async () => {
    if (!claim.trim()) return;
    setError(null);
    setLoading(true);
    setPhase(1);

    try {
      // ── Phase 1: Independent research ──
      setLoadingMsg("Agents researching independently...");
      const [r1, r2] = await Promise.all([
        apiCall(
          config.researcher,
          PROMPTS.researcher(AGENT_PROFILES[0]),
          `Evaluate this claim: "${claim}"`,
          AGENT_PROFILES[0].temp
        ),
        apiCall(
          config.researcher,
          PROMPTS.researcher(AGENT_PROFILES[1]),
          `Evaluate this claim: "${claim}"`,
          AGENT_PROFILES[1].temp
        ),
      ]);
      setAgents([r1, r2]);
      setPhase(2);

      // ── Phase 2: Adversary challenge ──
      setLoadingMsg("Tenth Man building counter-case...");
      const advResult = await apiCall(
        config.adversary,
        PROMPTS.adversary,
        buildAdversaryInput(claim, [r1, r2]),
        AGENT_PROFILES[2].temp,
        adversarySupportsSearch
      );
      setAdversary(advResult);
      setPhase(3);

      // ── Phase 3: Anonymous final vote ──
      setLoadingMsg("Anonymous blind review...");
      const [f1, f2] = await Promise.all([
        apiCall(
          config.researcher,
          PROMPTS.finalVote(),
          buildFinalVoteInput(claim, r1, advResult),
          0.2
        ),
        apiCall(
          config.researcher,
          PROMPTS.finalVote(),
          buildFinalVoteInput(claim, r2, advResult),
          0.2
        ),
      ]);
      f1.prevConf = r1.confidence;
      f2.prevConf = r2.confidence;
      setFinalAgents([f1, f2]);
      setPhase(4);

      // ── Record to history ──
      const record = buildHistoryRecord(claim, [r1, r2], advResult, [f1, f2], groundTruth || null);
      setHistory((prev) => [...prev, record]);
    } catch (e) {
      console.error(e);
      setError(e.message || "API call failed. Check console for details.");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }, [claim, groundTruth, config, adversarySupportsSearch]);

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: fonts.sans, padding: "36px 20px" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>⚔</span>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
              Falsify
            </h1>
          </div>
          <p style={{ margin: "4px 0 0 32px", fontSize: 11.5, color: colors.textDim, lineHeight: 1.5 }}>
            Stress-test ideas through structured adversarial debate
          </p>
        </div>

        <PhaseBar phases={PHASES} current={phase} />

        {/* Config */}
        <ConfigPanel config={config} onChange={setConfig} />

        {/* Input */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Enter a claim or idea to stress-test..."
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && phase === 0 && run()}
              disabled={loading || phase > 0}
              style={{
                flex: 1, background: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: 8, padding: "11px 14px", fontSize: 13.5, color: colors.text,
                outline: "none", fontFamily: "inherit",
              }}
            />
            {phase === 0 ? (
              <button onClick={run} disabled={loading || !claim.trim()} style={{
                background: colors.accent, color: "#fff", border: "none", borderRadius: 8,
                padding: "11px 22px", fontSize: 13, fontWeight: 600, cursor: !claim.trim() ? "not-allowed" : "pointer",
                opacity: !claim.trim() ? 0.4 : 1, fontFamily: "inherit",
              }}>
                Run
              </button>
            ) : (
              <button onClick={reset} disabled={loading} style={{
                background: "transparent", color: colors.textSoft, border: `1px solid ${colors.border}`,
                borderRadius: 8, padding: "11px 18px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}>
                New
              </button>
            )}
          </div>

          {/* Ground truth toggle */}
          {phase === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: colors.textDim, fontFamily: fonts.mono }}>GROUND TRUTH:</span>
              {["", "SUPPORT", "OPPOSE"].map((gt) => (
                <button key={gt} onClick={() => setGroundTruth(gt)} style={{
                  background: groundTruth === gt ? (gt === "SUPPORT" ? colors.supportDim : gt === "OPPOSE" ? colors.opposeDim : colors.surfaceRaised) : "transparent",
                  color: groundTruth === gt ? (gt === "SUPPORT" ? colors.support : gt === "OPPOSE" ? colors.oppose : colors.textSoft) : colors.textDim,
                  border: `1px solid ${groundTruth === gt ? (gt === "SUPPORT" ? colors.support + "40" : gt === "OPPOSE" ? colors.oppose + "40" : colors.border) : colors.border}`,
                  borderRadius: 6, padding: "4px 10px", fontSize: 10, fontFamily: fonts.mono,
                  cursor: "pointer", fontWeight: groundTruth === gt ? 600 : 400,
                }}>
                  {gt || "None"}
                </button>
              ))}
              <span style={{ fontSize: 9, color: colors.textDim, fontStyle: "italic" }}>
                Enables Brier score & accuracy
              </span>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 12, height: 12, border: `2px solid ${colors.border}`, borderTopColor: colors.accent,
                borderRadius: "50%", animation: "spin 0.8s linear infinite",
              }} />
              <span style={{ fontSize: 11, color: colors.textDim, fontFamily: fonts.mono }}>{loadingMsg}</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {error && (
            <div style={{ marginTop: 10, color: colors.oppose, fontSize: 11, padding: "8px 12px", background: colors.opposeDim, borderRadius: 6 }}>
              {error}
            </div>
          )}
        </div>

        {/* Phase 1: Research agents */}
        {agents[0] && agents[1] && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Tag color={colors.textSoft}>Phase 1 — Independent Research</Tag>
              <span style={{ fontSize: 9, color: colors.textDim, fontFamily: fonts.mono }}>
                t={AGENT_PROFILES[0].temp} / t={AGENT_PROFILES[1].temp}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <AgentCard agent={agents[0]} profile={AGENT_PROFILES[0]} />
              <AgentCard agent={agents[1]} profile={AGENT_PROFILES[1]} />
            </div>
            <div style={{
              marginTop: 10, padding: "7px 12px",
              background: agents[0].verdict === agents[1].verdict ? `${colors.accent}10` : colors.adversaryDim,
              borderRadius: 6, fontSize: 11, fontFamily: fonts.mono,
              color: agents[0].verdict === agents[1].verdict ? colors.accent : colors.adversary,
            }}>
              {agents[0].verdict === agents[1].verdict
                ? `✓ Consensus: ${agents[0].verdict} — Engaging adversary`
                : "⚡ Split verdict — Adversary will challenge both positions"}
            </div>
          </div>
        )}

        {/* Phase 2: Adversary */}
        {adversary && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Tag color={colors.adversary}>Phase 2 — Adversary Challenge</Tag>
              {adversarySupportsSearch && (
                <span style={{ fontSize: 9, color: colors.textDim, fontFamily: fonts.mono, background: colors.surfaceRaised, padding: "2px 6px", borderRadius: 4 }}>
                  🔍 web-grounded
                </span>
              )}
            </div>
            <AdversaryCard data={adversary} />
          </div>
        )}

        {/* Phase 3: Final vote */}
        {finalAgents[0] && finalAgents[1] && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Tag color={colors.textSoft}>Phase 3 — Anonymous Final Vote</Tag>
              <span style={{ fontSize: 9, color: colors.textDim, fontFamily: fonts.mono }}>identities stripped · t=0.2</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <AgentCard agent={finalAgents[0]} profile={AGENT_PROFILES[0]} phase="final" />
              <AgentCard agent={finalAgents[1]} profile={AGENT_PROFILES[1]} phase="final" />
            </div>

            {/* Verdict banner */}
            {(() => {
              const v1 = finalAgents[0].final_verdict, v2 = finalAgents[1].final_verdict;
              const c1 = finalAgents[0].confidence, c2 = finalAgents[1].confidence;
              const finalV = v1 === v2 ? v1 : (c1 > c2 ? v1 : v2);
              const initV = agents[0].verdict === agents[1].verdict ? agents[0].verdict :
                (agents[0].confidence > agents[1].confidence ? agents[0].verdict : agents[1].verdict);
              const reversed = finalV !== initV;

              return (
                <div style={{
                  marginTop: 12, padding: "14px 18px",
                  background: reversed ? colors.flipDim : colors.surface,
                  border: `1px solid ${reversed ? colors.flip + "30" : colors.border}`,
                  borderRadius: 10,
                  display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
                }}>
                  <div>
                    <div style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 2, color: colors.textDim, textTransform: "uppercase", marginBottom: 3 }}>
                      Final Majority Verdict
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: finalV === "SUPPORT" ? colors.support : colors.oppose }}>
                      {finalV}
                      {v1 !== v2 && <span style={{ fontSize: 10, color: colors.textDim, fontWeight: 400, marginLeft: 8 }}>(split)</span>}
                    </div>
                  </div>
                  {reversed
                    ? <Tag color={colors.flip} bg={colors.flipDim}>⚡ Adversary Overturned Consensus</Tag>
                    : <span style={{ color: colors.textDim, fontSize: 11, fontFamily: fonts.mono }}>Original verdict held</span>}
                </div>
              );
            })()}
          </div>
        )}

        {/* Metrics dashboard */}
        <MetricsPanel metrics={metrics} history={history} />
      </div>
    </div>
  );
}

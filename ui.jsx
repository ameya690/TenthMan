import { colors, fonts, evidenceColors } from "../theme";

export const Tag = ({ children, color = colors.textDim, bg = "transparent" }) => (
  <span
    style={{
      fontSize: 9,
      fontWeight: 700,
      fontFamily: fonts.mono,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color,
      background: bg,
      padding: bg !== "transparent" ? "2px 7px" : 0,
      borderRadius: 4,
    }}
  >
    {children}
  </span>
);

export const ConfBar = ({ value, color, label, prev }) => (
  <div style={{ marginBottom: 6 }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 10,
        color: colors.textDim,
        marginBottom: 3,
        fontFamily: fonts.mono,
      }}
    >
      <span>{label || "Confidence"}</span>
      <span>
        {prev !== undefined && prev !== value && (
          <span style={{ color: value > prev ? colors.support : colors.oppose, marginRight: 4 }}>
            {value > prev ? "+" : ""}
            {value - prev}
          </span>
        )}
        {value}%
      </span>
    </div>
    <div style={{ height: 3, background: colors.border, borderRadius: 2, overflow: "hidden", position: "relative" }}>
      {prev !== undefined && (
        <div style={{ position: "absolute", height: "100%", width: `${prev}%`, background: colors.textDim, opacity: 0.25, borderRadius: 2 }} />
      )}
      <div style={{ position: "relative", height: "100%", width: `${value}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
    </div>
  </div>
);

export const EvidenceTag = ({ type }) => {
  const c = evidenceColors[type] || colors.textDim;
  return <Tag color={c} bg={`${c}18`}>{type}</Tag>;
};

export const MetricCard = ({ label, value, sub, color, large }) => (
  <div
    style={{
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: large ? 18 : 14,
      display: "flex",
      flexDirection: "column",
      gap: 2,
    }}
  >
    <div style={{ fontSize: large ? 26 : 20, fontWeight: 700, color: color || colors.text, fontFamily: fonts.mono }}>
      {value}
    </div>
    <div style={{ fontSize: 11, fontWeight: 600, color: colors.text }}>{label}</div>
    {sub && <div style={{ fontSize: 9.5, color: colors.textDim }}>{sub}</div>}
  </div>
);

export const PhaseBar = ({ phases, current }) => (
  <div style={{ display: "flex", gap: 2, margin: "20px 0 28px" }}>
    {phases.map((p, i) => (
      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div
          style={{
            height: 3,
            width: "100%",
            borderRadius: 2,
            background:
              i < current
                ? colors.accent
                : i === current
                ? `linear-gradient(90deg, ${colors.accent}, ${colors.border})`
                : colors.border,
            transition: "background 0.5s",
          }}
        />
        <span
          style={{
            fontSize: 8,
            fontFamily: fonts.mono,
            letterSpacing: 1,
            color: i <= current ? colors.textSoft : colors.textDim,
            textTransform: "uppercase",
          }}
        >
          {p}
        </span>
      </div>
    ))}
  </div>
);

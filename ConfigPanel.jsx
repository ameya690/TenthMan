import { useState } from "react";
import { colors, fonts } from "../theme";
import { PROVIDERS } from "../api";
import { Tag } from "./ui";

export default function ConfigPanel({ config, onChange }) {
  const [open, setOpen] = useState(false);

  const updateRole = (role, field, value) => {
    onChange({ ...config, [role]: { ...config[role], [field]: value } });
  };

  const inputStyle = {
    background: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: "7px 10px",
    fontSize: 11,
    color: colors.text,
    fontFamily: fonts.mono,
    outline: "none",
    width: "100%",
  };

  const selectStyle = {
    ...inputStyle,
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    paddingRight: 24,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23475569'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
  };

  const RoleConfig = ({ role, label }) => {
    const rc = config[role];
    const provider = PROVIDERS[rc.provider];

    return (
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 10, color: colors.textDim, fontFamily: fonts.mono, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          {label}
        </div>

        {/* Provider select */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: colors.textDim, marginBottom: 3 }}>Provider</div>
          <select
            value={rc.provider}
            onChange={(e) => {
              const newProvider = e.target.value;
              const firstModel = PROVIDERS[newProvider].models[0].id;
              onChange({
                ...config,
                [role]: { ...rc, provider: newProvider, model: firstModel },
              });
            }}
            style={selectStyle}
          >
            {Object.entries(PROVIDERS).map(([key, p]) => (
              <option key={key} value={key}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Model select */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: colors.textDim, marginBottom: 3 }}>Model</div>
          <select value={rc.model} onChange={(e) => updateRole(role, "model", e.target.value)} style={selectStyle}>
            {provider.models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* API Key */}
        <div>
          <div style={{ fontSize: 9, color: colors.textDim, marginBottom: 3 }}>
            API Key {rc.provider === "anthropic" && <span style={{ color: colors.textDim }}>(optional in Claude.ai)</span>}
          </div>
          <input
            type="password"
            placeholder={rc.provider === "anthropic" ? "Auto-detected in Claude.ai" : "sk-..."}
            value={rc.apiKey || ""}
            onChange={(e) => updateRole(role, "apiKey", e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Search badge */}
        {role === "adversary" && (
          <div style={{ marginTop: 6, fontSize: 9, color: provider.supportsSearch ? colors.support : colors.textDim }}>
            {provider.supportsSearch ? "✓ Web search available" : "✗ No web search for this provider"}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "transparent",
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 10,
          color: colors.textSoft,
          cursor: "pointer",
          fontFamily: fonts.mono,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▸</span>
        Model Configuration
        <span style={{ fontSize: 8, color: colors.textDim }}>
          {PROVIDERS[config.researcher.provider].name} / {PROVIDERS[config.adversary.provider].name}
        </span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <RoleConfig role="researcher" label="Research Agents" />
            <RoleConfig role="adversary" label="Adversary (Tenth Man)" />
          </div>
          <div style={{ marginTop: 14, padding: "8px 12px", background: colors.surfaceRaised, borderRadius: 6, fontSize: 10, color: colors.textDim, lineHeight: 1.5 }}>
            Tip: Mix providers for maximum diversity — e.g. Claude researchers with a GPT-4o adversary.
            API keys are stored in memory only and never sent anywhere except the provider's API.
          </div>
        </div>
      )}
    </div>
  );
}

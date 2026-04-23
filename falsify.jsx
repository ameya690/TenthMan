import { useState, useCallback, useMemo } from "react";

// ═══════════════════════════════════════
// theme.js
// ═══════════════════════════════════════

const C = {
  bg: "#08090d", surface: "#0f1117", surfaceRaised: "#151821",
  border: "#1c2030", text: "#e2e8f0", textSoft: "#94a3b8", textDim: "#475569",
  accent: "#3b82f6", support: "#22c55e", supportDim: "rgba(34,197,94,0.1)",
  oppose: "#ef4444", opposeDim: "rgba(239,68,68,0.1)",
  adversary: "#f59e0b", adversaryDim: "rgba(245,158,11,0.08)",
  flip: "#a855f7", flipDim: "rgba(168,85,247,0.1)",
};
const mono = "'JetBrains Mono','Fira Code',monospace";
const sans = "'Inter',-apple-system,system-ui,sans-serif";
const evColors = { EMPIRICAL:"#38bdf8", LOGICAL:"#a78bfa", HISTORICAL:"#fb923c", INTUITIVE:"#34d399" };

// ═══════════════════════════════════════
// agents.js
// ═══════════════════════════════════════

const PROFILES = [
  { id:1, name:"Empiricist", icon:"◈", color:"#38bdf8", temp:0.3,
    persona:`You are the Empiricist — you prioritize data, studies, and measurable evidence. You distrust anecdotes and demand quantifiable proof. Your lens: "What does the data actually show?"` },
  { id:2, name:"Systems Thinker", icon:"◇", color:"#a78bfa", temp:0.6,
    persona:`You are the Systems Thinker — you look at interconnections, feedback loops, second-order effects. Your lens: "What downstream effects is nobody considering?"` },
  { id:3, name:"Contrarian", icon:"◆", color:"#fb923c", temp:0.8,
    persona:`You are the Contrarian — you actively search for counter-examples, edge cases, and historical precedents where the majority was wrong.` },
];

const SYS = {
  researcher: (p) => `${p.persona}\n\nEvaluate the claim independently:\n1. Verdict: SUPPORT or OPPOSE\n2. Confidence 0-100 (well-calibrated: 70 means wrong 30% of the time)\n3. Reasoning (2-3 sentences)\n4. Evidence type: EMPIRICAL, LOGICAL, HISTORICAL, or INTUITIVE\n5. One key assumption your reasoning depends on\n\nRespond ONLY in JSON, no markdown:\n{"verdict":"SUPPORT or OPPOSE","confidence":75,"reasoning":"...","evidence_type":"EMPIRICAL","key_assumption":"..."}`,

  adversary: `You are the Tenth Man — a designated adversarial analyst. You MUST argue against the majority.\n\nRULES:\n- Present the STRONGEST counter-case\n- Classify each evidence point: EMPIRICAL, LOGICAL, HISTORICAL, or INTUITIVE\n- Attack the key assumptions directly\n- Provide a concrete counter-example\n- Rate your own argument strength honestly (0-100)\n\nRespond ONLY in JSON:\n{"counter_argument":"...(3-5 sentences)","evidence_points":[{"point":"...","type":"EMPIRICAL"}],"assumption_attack":"...","counter_example":"...","self_rated_strength":72}`,

  finalVote: `You are an anonymous analyst in blind review. Your identity is stripped to prevent social pressure.\n\nYou previously evaluated a claim. A designated adversary has challenged the majority.\n\nINSTRUCTIONS:\n- Evaluate counter-arguments on MERIT, not social pressure\n- If changing: identify exactly which argument convinced you\n- If maintaining: explain why counter-arguments fail\n- Be honest about uncertainty\n\nRespond ONLY in JSON:\n{"final_verdict":"SUPPORT or OPPOSE","confidence":65,"changed":true,"change_trigger":"specific argument or null","reasoning":"...","uncertainty_factors":["..."]}`
};

// ═══════════════════════════════════════
// api.js
// ═══════════════════════════════════════

const PROVIDERS = {
  anthropic: { name:"Anthropic", models:[
    {id:"claude-sonnet-4-20250514",label:"Sonnet 4"},
    {id:"claude-opus-4-20250514",label:"Opus 4"}
  ], supportsSearch:true },
  openai: { name:"OpenAI", models:[
    {id:"gpt-4o",label:"GPT-4o"},
    {id:"gpt-4o-mini",label:"GPT-4o Mini"},
    {id:"o3-mini",label:"o3-mini"}
  ], supportsSearch:false },
};

const parseJSON = (raw) => JSON.parse(raw.replace(/```json|```/g,"").trim());

async function callAnthropic(apiKey,model,sys,msg,temp,search) {
  const h = {"Content-Type":"application/json"};
  if(apiKey){h["x-api-key"]=apiKey;h["anthropic-version"]="2023-06-01";}
  const body = {model,max_tokens:1000,system:sys,messages:[{role:"user",content:msg}],temperature:temp};
  if(search) body.tools=[{type:"web_search_20250305",name:"web_search"}];
  const r = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:h,body:JSON.stringify(body)});
  if(!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return parseJSON(d.content?.filter(b=>b.type==="text").map(b=>b.text||"").join("\n")||"");
}

async function callOpenAI(apiKey,model,sys,msg,temp) {
  if(!apiKey) throw new Error("OpenAI requires an API key. Add it in config.");
  const r = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},
    body:JSON.stringify({model,temperature:temp,messages:[{role:"system",content:sys},{role:"user",content:msg}]})
  });
  if(!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return parseJSON(d.choices?.[0]?.message?.content||"");
}

async function apiCall(cfg,sys,msg,temp=0.5,search=false) {
  return cfg.provider==="openai"
    ? callOpenAI(cfg.apiKey,cfg.model,sys,msg,temp)
    : callAnthropic(cfg.apiKey,cfg.model,sys,msg,temp,search);
}

// ═══════════════════════════════════════
// metrics.js
// ═══════════════════════════════════════

const brier = (conf,correct) => Math.pow(conf/100-(correct?1:0),2);
const maj = (v1,v2,c1,c2) => v1===v2?v1:c1>c2?v1:v2;

function buildRecord(claim,ags,adv,fins,gt) {
  const [r1,r2]=ags; const [f1,f2]=fins;
  const iM=maj(r1.verdict,r2.verdict,r1.confidence,r2.confidence);
  const fM=maj(f1.final_verdict,f2.final_verdict,f1.confidence,f2.confidence);
  const aIC=(r1.confidence+r2.confidence)/2, aFC=(f1.confidence+f2.confidence)/2;
  return {
    claim:claim.slice(0,55), initialMajority:iM, finalMajority:fM,
    allInitialAgree:r1.verdict===r2.verdict, anyAgentFlipped:f1.changed||f2.changed,
    flipCount:(f1.changed?1:0)+(f2.changed?1:0), majorityReversed:iM!==fM,
    adversaryStrength:adv.self_rated_strength, avgInitialConf:aIC, avgFinalConf:aFC,
    groundTruth:gt||null,
    brierInitial:gt?brier(aIC,iM===gt):null, brierFinal:gt?brier(aFC,fM===gt):null,
    evidenceTypes:[r1.evidence_type,r2.evidence_type].filter(Boolean),
  };
}

function calcMetrics(h) {
  const n=h.length; if(!n)return null;
  const wGT=h.filter(x=>x.groundTruth), iC=h.filter(x=>x.allInitialAgree).length;
  const fR=h.filter(x=>x.anyAgentFlipped), tF=h.reduce((a,x)=>a+x.flipCount,0);
  const vR=h.filter(x=>x.majorityReversed).length;
  const sF=fR.filter(x=>x.adversaryStrength<50).length;
  const aCD=h.reduce((a,x)=>a+(x.avgInitialConf-x.avgFinalConf),0)/n;
  let aBI=null,aBF=null,aI=null,aF=null;
  if(wGT.length){const g=wGT.length;aBI=wGT.reduce((a,x)=>a+x.brierInitial,0)/g;aBF=wGT.reduce((a,x)=>a+x.brierFinal,0)/g;aI=wGT.filter(x=>x.initialMajority===x.groundTruth).length/g;aF=wGT.filter(x=>x.finalMajority===x.groundTruth).length/g;}
  const td={}; h.flatMap(x=>x.evidenceTypes).forEach(t=>td[t]=(td[t]||0)+1);
  return {totalRuns:n,initialConsensusRate:iC/n,initialConsensus:iC,flipRate:fR.length/n,flippedRuns:fR.length,totalAgentFlips:tF,verdictReversalRate:vR/n,verdictReversals:vR,sycophancyRate:fR.length?sF/fR.length:0,avgConfDrop:aCD,avgBrierInitial:aBI,avgBrierFinal:aBF,brierImproved:aBF!==null&&aBF<aBI,accuracyInitial:aI,accuracyFinal:aF,evidenceDistribution:td,runsWithGT:wGT.length};
}

// ═══════════════════════════════════════
// UI Primitives
// ═══════════════════════════════════════

const Tag=({children,color=C.textDim,bg="transparent"})=>(
  <span style={{fontSize:9,fontWeight:700,fontFamily:mono,letterSpacing:1.2,textTransform:"uppercase",color,background:bg,padding:bg!=="transparent"?"2px 7px":0,borderRadius:4}}>{children}</span>
);

const ConfBar=({value,color,prev})=>(
  <div style={{marginBottom:6}}>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.textDim,marginBottom:3,fontFamily:mono}}>
      <span>Confidence</span>
      <span>{prev!==undefined&&prev!==value&&<span style={{color:value>prev?C.support:C.oppose,marginRight:4}}>{value>prev?"+":""}{value-prev}</span>}{value}%</span>
    </div>
    <div style={{height:3,background:C.border,borderRadius:2,overflow:"hidden",position:"relative"}}>
      {prev!==undefined&&<div style={{position:"absolute",height:"100%",width:`${prev}%`,background:C.textDim,opacity:0.25,borderRadius:2}}/>}
      <div style={{position:"relative",height:"100%",width:`${value}%`,background:color,borderRadius:2,transition:"width 0.6s ease"}}/>
    </div>
  </div>
);

const EvTag=({type})=>{const c=evColors[type]||C.textDim;return<Tag color={c} bg={`${c}18`}>{type}</Tag>};
const MCard=({label,value,sub,color})=>(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:14}}><div style={{fontSize:20,fontWeight:700,color:color||C.text,fontFamily:mono}}>{value}</div><div style={{fontSize:11,fontWeight:600,color:C.text}}>{label}</div>{sub&&<div style={{fontSize:9.5,color:C.textDim}}>{sub}</div>}</div>);

// ═══════════════════════════════════════
// ConfigPanel
// ═══════════════════════════════════════

function ConfigPanel({config,onChange}) {
  const [open,setOpen]=useState(false);
  const iS={background:C.surfaceRaised,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",fontSize:11,color:C.text,fontFamily:mono,outline:"none",width:"100%"};
  const sS={...iS,cursor:"pointer",appearance:"none",WebkitAppearance:"none",paddingRight:24,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23475569'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 8px center"};

  const RC=({role,label})=>{
    const rc=config[role]; const prov=PROVIDERS[rc.provider];
    return(
      <div style={{flex:1,minWidth:220}}>
        <div style={{fontSize:10,color:C.textDim,fontFamily:mono,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>{label}</div>
        <div style={{marginBottom:8}}><div style={{fontSize:9,color:C.textDim,marginBottom:3}}>Provider</div>
          <select value={rc.provider} onChange={e=>{const np=e.target.value;onChange({...config,[role]:{...rc,provider:np,model:PROVIDERS[np].models[0].id}})}} style={sS}>
            {Object.entries(PROVIDERS).map(([k,p])=><option key={k} value={k}>{p.name}</option>)}
          </select>
        </div>
        <div style={{marginBottom:8}}><div style={{fontSize:9,color:C.textDim,marginBottom:3}}>Model</div>
          <select value={rc.model} onChange={e=>onChange({...config,[role]:{...rc,model:e.target.value}})} style={sS}>
            {prov.models.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div><div style={{fontSize:9,color:C.textDim,marginBottom:3}}>API Key {rc.provider==="anthropic"&&<span style={{color:C.textDim}}>(optional in Claude.ai)</span>}</div>
          <input type="password" placeholder={rc.provider==="anthropic"?"Auto-detected in Claude.ai":"sk-..."} value={rc.apiKey||""} onChange={e=>onChange({...config,[role]:{...rc,apiKey:e.target.value}})} style={iS}/>
        </div>
        {role==="adversary"&&<div style={{marginTop:6,fontSize:9,color:prov.supportsSearch?C.support:C.textDim}}>{prov.supportsSearch?"✓ Web search available":"✗ No web search"}</div>}
      </div>
    );
  };

  return(
    <div style={{marginBottom:16}}>
      <button onClick={()=>setOpen(!open)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 12px",fontSize:10,color:C.textSoft,cursor:"pointer",fontFamily:mono,display:"flex",alignItems:"center",gap:6}}>
        <span style={{transform:open?"rotate(90deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>▸</span>
        Model Config
        <span style={{fontSize:8,color:C.textDim}}>{PROVIDERS[config.researcher.provider].name} / {PROVIDERS[config.adversary.provider].name}</span>
      </button>
      {open&&<div style={{marginTop:8,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:18}}>
        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}><RC role="researcher" label="Research Agents"/><RC role="adversary" label="Adversary"/></div>
        <div style={{marginTop:14,padding:"8px 12px",background:C.surfaceRaised,borderRadius:6,fontSize:10,color:C.textDim,lineHeight:1.5}}>Mix providers for diversity — e.g. Claude researchers + GPT-4o adversary. Keys stay in memory only.</div>
      </div>}
    </div>
  );
}

// ═══════════════════════════════════════
// AgentCard
// ═══════════════════════════════════════

function AgentCard({agent,profile,phase="initial"}) {
  const v=phase==="final"?agent.final_verdict:agent.verdict;
  const isS=v==="SUPPORT"; const color=isS?C.support:C.oppose;
  return(
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:18,flex:1,minWidth:180,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:profile.color}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:profile.color,fontSize:14}}>{profile.icon}</span><Tag color={profile.color}>{profile.name}</Tag></div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          {phase==="final"&&agent.changed&&<Tag color={C.flip} bg={C.flipDim}>Flipped</Tag>}
          <span style={{fontSize:11,fontWeight:700,fontFamily:mono,color,background:isS?C.supportDim:C.opposeDim,padding:"3px 9px",borderRadius:12}}>{v}</span>
        </div>
      </div>
      <ConfBar value={agent.confidence} color={color} prev={phase==="final"?agent.prevConf:undefined}/>
      <p style={{color:C.textSoft,fontSize:12,lineHeight:1.6,margin:"8px 0"}}>{agent.reasoning}</p>
      {phase==="initial"&&agent.evidence_type&&<div style={{display:"flex",gap:6,alignItems:"center",marginTop:8}}><EvTag type={agent.evidence_type}/>{agent.key_assumption&&<span style={{fontSize:10,color:C.textDim,fontStyle:"italic"}}>Assumes: {agent.key_assumption.length>60?agent.key_assumption.slice(0,60)+"…":agent.key_assumption}</span>}</div>}
      {phase==="final"&&agent.change_trigger&&<div style={{marginTop:8,padding:"6px 10px",background:C.flipDim,borderRadius:6,fontSize:11,color:C.flip}}>Trigger: {agent.change_trigger}</div>}
      {phase==="final"&&agent.uncertainty_factors?.length>0&&<div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:4}}>{agent.uncertainty_factors.map((f,i)=><span key={i} style={{fontSize:9,color:C.textDim,background:C.surfaceRaised,padding:"2px 6px",borderRadius:4}}>⚠ {f}</span>)}</div>}
    </div>
  );
}

// ═══════════════════════════════════════
// AdversaryCard
// ═══════════════════════════════════════

function AdversaryCard({data}) {
  return(
    <div style={{background:C.surface,border:`1px solid ${C.adversary}30`,borderRadius:10,padding:20,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:C.adversary}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>⚔</span><Tag color={C.adversary}>Tenth Man — Adversary</Tag></div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:9,color:C.textDim,fontFamily:mono}}>SELF-RATED</span>
          <span style={{fontSize:12,fontWeight:700,fontFamily:mono,color:C.adversary,background:C.adversaryDim,padding:"2px 8px",borderRadius:8}}>{data.self_rated_strength}/100</span>
        </div>
      </div>
      <p style={{color:C.text,fontSize:13,lineHeight:1.65,margin:"0 0 14px"}}>{data.counter_argument}</p>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
        {data.evidence_points?.map((ep,i)=><div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:12}}>
          <span style={{color:C.adversary,flexShrink:0,marginTop:1}}>→</span>
          <span style={{color:C.textSoft,flex:1}}>{typeof ep==="string"?ep:ep.point}</span>
          {typeof ep!=="string"&&ep.type&&<EvTag type={ep.type}/>}
        </div>)}
      </div>
      {data.assumption_attack&&<div style={{background:C.adversaryDim,borderRadius:6,padding:"8px 12px",fontSize:11.5,color:C.adversary,marginBottom:8}}><strong>Assumption under attack:</strong> {data.assumption_attack}</div>}
      {data.counter_example&&<div style={{background:C.surfaceRaised,borderRadius:6,padding:"8px 12px",fontSize:11.5,color:C.textSoft}}><strong style={{color:C.text}}>Counter-example:</strong> {data.counter_example}</div>}
    </div>
  );
}

// ═══════════════════════════════════════
// MetricsPanel
// ═══════════════════════════════════════

function MetricsPanel({metrics:m,history}) {
  if(!m)return null;
  return(
    <div style={{marginTop:32}}>
      <Tag color={C.textSoft}>Framework Effectiveness Dashboard</Tag>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginTop:14,marginBottom:12}}>
        <MCard label="Total Runs" value={m.totalRuns} sub="experiments"/>
        <MCard label="Consensus Rate" value={`${Math.round(m.initialConsensusRate*100)}%`} sub={`${m.initialConsensus}/${m.totalRuns}`}/>
        <MCard label="Flip Rate" value={`${Math.round(m.flipRate*100)}%`} sub={`${m.totalAgentFlips} flips`} color={C.adversary}/>
        <MCard label="Reversals" value={`${Math.round(m.verdictReversalRate*100)}%`} sub={`${m.verdictReversals} overturned`} color={C.flip}/>
        <MCard label="Sycophancy" value={`${Math.round(m.sycophancyRate*100)}%`} sub="weak-adversary flips" color={m.sycophancyRate>0.3?C.oppose:C.support}/>
        <MCard label="Avg Conf Δ" value={`${m.avgConfDrop>0?"-":"+"}${Math.abs(m.avgConfDrop).toFixed(1)}`} sub="post-adversary" color={m.avgConfDrop>0?C.adversary:C.support}/>
      </div>
      {m.runsWithGT>0&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:12}}>
        <Tag color={C.accent}>Accuracy & Calibration ({m.runsWithGT} with GT)</Tag>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
          <div><div style={{fontSize:10,color:C.textDim,fontFamily:mono,marginBottom:4}}>ACCURACY</div><div style={{fontSize:18,fontWeight:700,fontFamily:mono}}><span style={{color:C.textSoft}}>{Math.round(m.accuracyInitial*100)}%</span><span style={{color:C.textDim,margin:"0 6px"}}>→</span><span style={{color:m.accuracyFinal>=m.accuracyInitial?C.support:C.oppose}}>{Math.round(m.accuracyFinal*100)}%</span></div></div>
          <div><div style={{fontSize:10,color:C.textDim,fontFamily:mono,marginBottom:4}}>BRIER SCORE</div><div style={{fontSize:18,fontWeight:700,fontFamily:mono}}><span style={{color:C.textSoft}}>{m.avgBrierInitial?.toFixed(3)}</span><span style={{color:C.textDim,margin:"0 6px"}}>→</span><span style={{color:m.brierImproved?C.support:C.oppose}}>{m.avgBrierFinal?.toFixed(3)}</span></div></div>
        </div>
      </div>}
      {Object.keys(m.evidenceDistribution).length>0&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:12}}>
        <Tag color={C.textSoft}>Evidence Diversity</Tag>
        <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
          {Object.entries(m.evidenceDistribution).map(([t,c])=>{const tot=Object.values(m.evidenceDistribution).reduce((a,b)=>a+b,0);return<div key={t} style={{display:"flex",alignItems:"center",gap:6,background:C.surfaceRaised,padding:"6px 10px",borderRadius:6}}><EvTag type={t}/><span style={{fontSize:12,fontWeight:600,fontFamily:mono,color:C.text}}>{Math.round(c/tot*100)}%</span></div>})}
        </div>
      </div>}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}`,fontSize:9,color:C.textDim,fontFamily:mono,letterSpacing:1,textTransform:"uppercase",display:"grid",gridTemplateColumns:"1fr 70px 60px 70px 60px 60px",gap:6}}>
          <span>Claim</span><span>Initial</span><span>Adv.</span><span>Final</span><span>Δ Conf</span><span>Result</span>
        </div>
        {history.map((h,i)=><div key={i} style={{padding:"9px 14px",borderBottom:i<history.length-1?`1px solid ${C.border}`:"none",fontSize:11,display:"grid",gridTemplateColumns:"1fr 70px 60px 70px 60px 60px",gap:6,alignItems:"center"}}>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:C.textSoft,fontSize:10}}>{h.claim}</span>
          <span style={{color:h.initialMajority==="SUPPORT"?C.support:C.oppose,fontSize:10,fontWeight:600}}>{h.initialMajority}</span>
          <span style={{color:C.adversary,fontFamily:mono,fontSize:10}}>{h.adversaryStrength}/100</span>
          <span style={{color:h.finalMajority==="SUPPORT"?C.support:C.oppose,fontSize:10,fontWeight:600}}>{h.finalMajority}</span>
          <span style={{fontFamily:mono,fontSize:10,color:h.avgInitialConf-h.avgFinalConf>0?C.adversary:C.support}}>{h.avgInitialConf-h.avgFinalConf>0?"-":"+"}{Math.abs(h.avgInitialConf-h.avgFinalConf).toFixed(0)}</span>
          <span>{h.majorityReversed?<Tag color={C.flip} bg={C.flipDim}>Reversed</Tag>:<span style={{color:C.textDim,fontSize:9}}>held</span>}</span>
        </div>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Main App
// ═══════════════════════════════════════

export default function Falsify() {
  const [claim,setClaim]=useState("");
  const [gt,setGt]=useState("");
  const [phase,setPhase]=useState(0);
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState("");
  const [ags,setAgs]=useState([null,null]);
  const [adv,setAdv]=useState(null);
  const [fins,setFins]=useState([null,null]);
  const [history,setHistory]=useState([]);
  const [err,setErr]=useState(null);
  const [config,setConfig]=useState({researcher:{provider:"anthropic",model:"claude-sonnet-4-20250514"},adversary:{provider:"anthropic",model:"claude-sonnet-4-20250514"}});
  const metrics=useMemo(()=>calcMetrics(history),[history]);
  const advSearch=PROVIDERS[config.adversary.provider]?.supportsSearch;

  const reset=()=>{setPhase(0);setAgs([null,null]);setAdv(null);setFins([null,null]);setErr(null);setClaim("");setGt("")};

  const run=useCallback(async()=>{
    if(!claim.trim())return; setErr(null);setLoading(true);setPhase(1);
    try {
      setMsg("Agents researching independently...");
      const [r1,r2]=await Promise.all([
        apiCall(config.researcher,SYS.researcher(PROFILES[0]),`Evaluate this claim: "${claim}"`,PROFILES[0].temp),
        apiCall(config.researcher,SYS.researcher(PROFILES[1]),`Evaluate this claim: "${claim}"`,PROFILES[1].temp),
      ]);
      setAgs([r1,r2]);setPhase(2);

      setMsg("Tenth Man building counter-case...");
      const mV=r1.verdict===r2.verdict?r1.verdict:"SPLIT";
      const aI=`Claim: "${claim}"\n\nAgent A: ${r1.verdict} (${r1.confidence}%) — ${r1.reasoning}\nAssumption: ${r1.key_assumption}\n\nAgent B: ${r2.verdict} (${r2.confidence}%) — ${r2.reasoning}\nAssumption: ${r2.key_assumption}\n\nMajority: ${mV}. Argue AGAINST it.`;
      const aR=await apiCall(config.adversary,SYS.adversary,aI,PROFILES[2].temp,advSearch);
      setAdv(aR);setPhase(3);

      setMsg("Anonymous blind review...");
      const fCtx=(o)=>`Claim: "${claim}"\n\nYOUR ORIGINAL: ${o.verdict} (${o.confidence}%) — ${o.reasoning}\n\nADVERSARY (strength ${aR.self_rated_strength}/100):\n${aR.counter_argument}\n\nEvidence: ${aR.evidence_points?.map(e=>typeof e==="string"?e:e.point).join("; ")}\nAssumption attack: ${aR.assumption_attack}\nCounter-example: ${aR.counter_example}\n\nGive your FINAL anonymous verdict.`;
      const [f1,f2]=await Promise.all([
        apiCall(config.researcher,SYS.finalVote,fCtx(r1),0.2),
        apiCall(config.researcher,SYS.finalVote,fCtx(r2),0.2),
      ]);
      f1.prevConf=r1.confidence;f2.prevConf=r2.confidence;
      setFins([f1,f2]);setPhase(4);
      setHistory(p=>[...p,buildRecord(claim,[r1,r2],aR,[f1,f2],gt||null)]);
    } catch(e){console.error(e);setErr(e.message||"API call failed");}
    finally{setLoading(false);setMsg("");}
  },[claim,gt,config,advSearch]);

  const phases=["Setup","Research","Challenge","Vote","Results"];

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:sans,padding:"36px 20px"}}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{maxWidth:760,margin:"0 auto"}}>
        <div style={{marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>⚔</span>
            <h1 style={{margin:0,fontSize:20,fontWeight:700,letterSpacing:-0.5}}>Falsify</h1>
          </div>
          <p style={{margin:"4px 0 0 32px",fontSize:11.5,color:C.textDim,lineHeight:1.5}}>Stress-test ideas through structured adversarial debate</p>
        </div>

        <div style={{display:"flex",gap:2,margin:"20px 0 28px"}}>
          {phases.map((p,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{height:3,width:"100%",borderRadius:2,background:i<phase?C.accent:i===phase?`linear-gradient(90deg,${C.accent},${C.border})`:C.border,transition:"background 0.5s"}}/>
            <span style={{fontSize:8,fontFamily:mono,letterSpacing:1,color:i<=phase?C.textSoft:C.textDim,textTransform:"uppercase"}}>{p}</span>
          </div>)}
        </div>

        <ConfigPanel config={config} onChange={setConfig}/>

        <div style={{marginBottom:28}}>
          <div style={{display:"flex",gap:8}}>
            <input type="text" placeholder="Enter a claim or idea to stress-test..." value={claim} onChange={e=>setClaim(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!loading&&phase===0&&run()} disabled={loading||phase>0}
              style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 14px",fontSize:13.5,color:C.text,outline:"none",fontFamily:"inherit"}}/>
            {phase===0
              ?<button onClick={run} disabled={loading||!claim.trim()} style={{background:C.accent,color:"#fff",border:"none",borderRadius:8,padding:"11px 22px",fontSize:13,fontWeight:600,cursor:!claim.trim()?"not-allowed":"pointer",opacity:!claim.trim()?0.4:1,fontFamily:"inherit"}}>Run</button>
              :<button onClick={reset} disabled={loading} style={{background:"transparent",color:C.textSoft,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 18px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>New</button>
            }
          </div>
          {phase===0&&<div style={{display:"flex",alignItems:"center",gap:10,marginTop:10,flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:C.textDim,fontFamily:mono}}>GROUND TRUTH:</span>
            {["","SUPPORT","OPPOSE"].map(g=><button key={g} onClick={()=>setGt(g)} style={{background:gt===g?(g==="SUPPORT"?C.supportDim:g==="OPPOSE"?C.opposeDim:C.surfaceRaised):"transparent",color:gt===g?(g==="SUPPORT"?C.support:g==="OPPOSE"?C.oppose:C.textSoft):C.textDim,border:`1px solid ${gt===g?(g==="SUPPORT"?C.support+"40":g==="OPPOSE"?C.oppose+"40":C.border):C.border}`,borderRadius:6,padding:"4px 10px",fontSize:10,fontFamily:mono,cursor:"pointer",fontWeight:gt===g?600:400}}>{g||"None"}</button>)}
            <span style={{fontSize:9,color:C.textDim,fontStyle:"italic"}}>Enables Brier scores</span>
          </div>}
          {loading&&<div style={{marginTop:12,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:12,height:12,border:`2px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
            <span style={{fontSize:11,color:C.textDim,fontFamily:mono}}>{msg}</span>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>}
          {err&&<div style={{marginTop:10,color:C.oppose,fontSize:11,padding:"8px 12px",background:C.opposeDim,borderRadius:6}}>{err}</div>}
        </div>

        {ags[0]&&ags[1]&&<div style={{marginBottom:22}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Tag color={C.textSoft}>Phase 1 — Independent Research</Tag><span style={{fontSize:9,color:C.textDim,fontFamily:mono}}>t={PROFILES[0].temp} / t={PROFILES[1].temp}</span></div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><AgentCard agent={ags[0]} profile={PROFILES[0]}/><AgentCard agent={ags[1]} profile={PROFILES[1]}/></div>
          <div style={{marginTop:10,padding:"7px 12px",background:ags[0].verdict===ags[1].verdict?`${C.accent}10`:C.adversaryDim,borderRadius:6,fontSize:11,fontFamily:mono,color:ags[0].verdict===ags[1].verdict?C.accent:C.adversary}}>
            {ags[0].verdict===ags[1].verdict?`✓ Consensus: ${ags[0].verdict} — Engaging adversary`:"⚡ Split — Adversary challenges both"}
          </div>
        </div>}

        {adv&&<div style={{marginBottom:22}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Tag color={C.adversary}>Phase 2 — Adversary Challenge</Tag>{advSearch&&<span style={{fontSize:9,color:C.textDim,fontFamily:mono,background:C.surfaceRaised,padding:"2px 6px",borderRadius:4}}>🔍 web-grounded</span>}</div>
          <AdversaryCard data={adv}/>
        </div>}

        {fins[0]&&fins[1]&&<div style={{marginBottom:22}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Tag color={C.textSoft}>Phase 3 — Anonymous Vote</Tag><span style={{fontSize:9,color:C.textDim,fontFamily:mono}}>identities stripped · t=0.2</span></div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><AgentCard agent={fins[0]} profile={PROFILES[0]} phase="final"/><AgentCard agent={fins[1]} profile={PROFILES[1]} phase="final"/></div>
          {(()=>{
            const v1=fins[0].final_verdict,v2=fins[1].final_verdict,c1=fins[0].confidence,c2=fins[1].confidence;
            const fV=v1===v2?v1:c1>c2?v1:v2;
            const iV=ags[0].verdict===ags[1].verdict?ags[0].verdict:ags[0].confidence>ags[1].confidence?ags[0].verdict:ags[1].verdict;
            const rev=fV!==iV;
            return<div style={{marginTop:12,padding:"14px 18px",background:rev?C.flipDim:C.surface,border:`1px solid ${rev?C.flip+"30":C.border}`,borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
              <div><div style={{fontFamily:mono,fontSize:9,letterSpacing:2,color:C.textDim,textTransform:"uppercase",marginBottom:3}}>Final Majority Verdict</div>
                <div style={{fontSize:20,fontWeight:700,color:fV==="SUPPORT"?C.support:C.oppose}}>{fV}{v1!==v2&&<span style={{fontSize:10,color:C.textDim,fontWeight:400,marginLeft:8}}>(split)</span>}</div>
              </div>
              {rev?<Tag color={C.flip} bg={C.flipDim}>⚡ Adversary Overturned Consensus</Tag>:<span style={{color:C.textDim,fontSize:11,fontFamily:mono}}>Original verdict held</span>}
            </div>
          })()}
        </div>}

        <MetricsPanel metrics={metrics} history={history}/>
      </div>
    </div>
  );
}

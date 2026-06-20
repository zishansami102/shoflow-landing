import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/* A faithful, mostly-mocked replica of ShoFlow's open-flow view for the landing
 * hero: side panel + breadcrumb + node-centered expanded view (in-node flowchart +
 * Edit button) + legend + Agent/Data mode toggle. Real: zoom/pan/drag/fit, the
 * "In this flow" navigation, node focus, and the mode toggle. Mocked (present but
 * inert): Regenerate / Add Triggers / Edit / View connector. One demo flow. */

const C = {
  base: "#15120F", panel: "#1B1712", panel2: "#211C16", card: "#2A241D", chip: "#241E18",
  border: "rgba(237,230,215,0.12)", borderSub: "rgba(237,230,215,0.07)",
  text: "#EDE6D7", text2: "#A79D8C", text3: "#6E6557",
  accent: "#E85D42", accentSub: "rgba(232,93,66,0.16)", active: "rgba(237,230,215,0.06)",
  read: "#6BA3BE", write: "#8FA083", run: "#D4845A", create: "#6DBAA1", step: "#8C8475",
};
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const UI = '"Inter Variable", Inter, system-ui, sans-serif';

type Op = "read" | "write" | "run" | "create" | "step";
type Kind = "file" | "app" | "skill" | "trigger";
interface Step { op: Op; label: string }
interface NData {
  kind: Kind; eyebrow: string; title: string; desc?: string; logo?: string; code?: boolean;
  flow?: Step[]; connector?: string; focused?: boolean; onEdit?: () => void; onBack?: () => void;
  [k: string]: unknown;
}
const opColor: Record<Op, string> = { read: C.read, write: C.write, run: C.run, create: C.create, step: C.step };

const FileGlyph = ({ s = 30, c = C.text2 }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
  </svg>
);
const NodeIcon = ({ d }: { d: NData }) =>
  d.logo ? <img src={d.logo} alt="" width={32} height={32} style={{ objectFit: "contain" }} /> : <FileGlyph />;

const handleStyle = { width: 7, height: 7, background: C.text3, border: `2px solid ${C.card}` };

/* Compact in-node flowchart (static mock of the app's Mermaid sub-flow). */
function MiniFlow({ steps }: { steps: Step[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {steps.map((s, i) => (
        <div key={i}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel2, border: `1px solid ${C.borderSub}`, borderLeft: `2px solid ${opColor[s.op]}`, borderRadius: 7, padding: "6px 10px" }}>
            <span style={{ fontFamily: MONO, fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.08em", color: opColor[s.op], minWidth: 34 }}>{s.op}</span>
            <span style={{ fontFamily: UI, fontSize: 11.5, color: C.text2, lineHeight: 1.3 }}>{s.label}</span>
          </div>
          {i < steps.length - 1 && <div style={{ width: 1, height: 10, background: C.border, margin: "0 0 0 18px" }} />}
        </div>
      ))}
    </div>
  );
}

function AppNode({ data }: NodeProps & { data: NData }) {
  return (
    <div style={{ width: 264, display: "flex", background: C.card, borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,0.38)", border: `1px solid ${C.border}` }}>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -2 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -2 }} />
      <div style={{ width: 50, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: C.chip, borderRight: `1px solid ${C.borderSub}` }}><NodeIcon d={data} /></div>
      <div style={{ minWidth: 0, flex: 1, padding: "10px 12px 11px" }}>
        <div style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.13em", color: C.text3 }}>{data.eyebrow}</div>
        <div style={{ marginTop: 1, fontWeight: 700, fontSize: data.code ? 12 : 14.5, color: C.text, lineHeight: 1.22, fontFamily: data.code ? MONO : UI, letterSpacing: "-0.01em" }}>{data.title}</div>
        {data.desc && <div style={{ marginTop: 4, fontSize: 11.5, color: C.text2, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{data.desc}</div>}
        {data.connector && (
          <button onClick={(e) => { e.stopPropagation(); }} style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: MONO, fontSize: 10, color: C.text2, background: C.base, border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 9px" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: C.write }} /> {data.connector}
          </button>
        )}
      </div>
    </div>
  );
}

function ExpandedNode({ data }: NodeProps & { data: NData }) {
  return (
    <div style={{ width: 340, background: C.card, borderRadius: 14, overflow: "hidden", boxShadow: `0 0 0 2px ${C.accent}, 0 18px 50px rgba(0,0,0,0.5)`, border: `1px solid ${C.accent}` }}>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -2 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -2 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderBottom: `1px solid ${C.borderSub}` }}>
        <div style={{ width: 40, height: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: C.chip, borderRadius: 9 }}><NodeIcon d={data} /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.13em", color: C.text3 }}>{data.eyebrow}</div>
          <div style={{ fontWeight: 700, fontSize: data.code ? 12.5 : 15, color: C.text, fontFamily: data.code ? MONO : UI, letterSpacing: "-0.01em" }}>{data.title}</div>
        </div>
      </div>
      {data.flow && (
        <div style={{ padding: "12px 14px" }}>
          <div style={{ fontFamily: MONO, fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.12em", color: C.text3, marginBottom: 8 }}>Instruction flow</div>
          <MiniFlow steps={data.flow} />
        </div>
      )}
      <div style={{ display: "flex", gap: 8, padding: "11px 14px", borderTop: `1px solid ${C.borderSub}` }}>
        <button onClick={(e) => e.stopPropagation()} style={{ flex: 1, cursor: "pointer", fontFamily: UI, fontSize: 12.5, fontWeight: 600, color: C.base, background: C.accent, border: "none", borderRadius: 8, padding: "8px 0" }}>Edit</button>
        <button onClick={(e) => e.stopPropagation()} style={{ cursor: "pointer", fontFamily: UI, fontSize: 12.5, fontWeight: 500, color: C.text2, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px" }}>Open file</button>
      </div>
    </div>
  );
}
const nodeTypes = { app: AppNode, expanded: ExpandedNode };

const SRC_FLOW: Step[] = [
  { op: "read", label: "Pull Tier-1 Twitter/X profiles" },
  { op: "read", label: "Load writing voice & tone" },
  { op: "step", label: "Score & filter for high-signal tweets" },
  { op: "run", label: "Open candidates in Chrome" },
  { op: "write", label: "Append qualifying tweets to the log" },
  { op: "write", label: "Alert on session failure" },
];
const VOICE_FLOW: Step[] = [
  { op: "read", label: "Load platform tone rules" },
  { op: "step", label: "Apply voice to generated drafts" },
];

const NODES: { id: string; w: number; h: number; pos: { x: number; y: number }; data: NData }[] = [
  { id: "src", w: 264, h: 86, pos: { x: 40, y: 260 }, data: { kind: "file", eyebrow: "File", title: "TWITTER-GUIDELINES.md", code: true, desc: "Scans Twitter/X for high-signal AI tweets, filters and scores them, logs qualifying…", flow: SRC_FLOW } },
  { id: "voice", w: 264, h: 86, pos: { x: 480, y: 40 }, data: { kind: "file", eyebrow: "File", title: "voice.md", code: true, desc: "Defines the writing voice, tone, and platform-specific style rules.", flow: VOICE_FLOW } },
  { id: "chrome", w: 264, h: 86, pos: { x: 480, y: 190 }, data: { kind: "app", eyebrow: "Google Chrome", title: "Twitter / X profiles", logo: "/brand/chrome.svg", desc: "Verify Twitter session and scan Tier-1 profiles in Chrome." } },
  { id: "sheets", w: 264, h: 86, pos: { x: 480, y: 340 }, data: { kind: "app", eyebrow: "Google Sheets", title: "Rolling 30-day Twitter log", logo: "/brand/googlesheets.svg", desc: "Log qualifying tweets to the rolling 30-day Twitter log.", connector: "MCP · 14 tools" } },
  { id: "telegram", w: 264, h: 86, pos: { x: 480, y: 490 }, data: { kind: "app", eyebrow: "Telegram", title: "Telegram alerts", logo: "/brand/telegram.svg", desc: "Send a session-expiry or failure alert.", connector: "MCP · 6 tools" } },
];
const EDGES_RAW = [
  { id: "e1", source: "src", target: "voice", op: "read" as Op, dash: "4 3" },
  { id: "e2", source: "src", target: "chrome", op: "run" as Op, dash: "5 4" },
  { id: "e3", source: "src", target: "sheets", op: "write" as Op },
  { id: "e4", source: "src", target: "telegram", op: "write" as Op },
];
const opLabel = (op: Op, dataMode: boolean) =>
  dataMode ? ({ read: "Input", write: "Output", run: "Run", create: "Output", step: "" }[op]) : (op[0].toUpperCase() + op.slice(1));

const GROUPS = [
  { label: "Files", ids: ["src", "voice"] },
  { label: "Connected apps", ids: ["chrome", "sheets", "telegram"] },
];

function Inner() {
  const { fitView } = useReactFlow();
  const [dataMode, setDataMode] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NData>>(
    NODES.map((n) => ({ id: n.id, type: "app", position: n.pos, data: n.data })) as Node<NData>[],
  );

  const focusNode = useCallback((id: string) => {
    const n = NODES.find((x) => x.id === id)!;
    const expand = n.data.kind === "file" || n.data.kind === "trigger" || n.data.kind === "skill";
    setFocused(id);
    setNodes((prev) => prev.map((p) => ({ ...p, type: p.id === id && expand ? "expanded" : "app", selected: p.id === id, data: { ...p.data, focused: p.id === id } })));
    // Frame the focused node itself (whole expanded card visible). Delay lets the
    // swapped expanded node measure its real height first.
    setTimeout(() => fitView({ nodes: [{ id }], padding: expand ? 0.22 : 0.55, maxZoom: expand ? 1.05 : 1.5, duration: 480 }), 80);
  }, [fitView, setNodes]);

  const back = useCallback(() => {
    setFocused(null);
    setNodes((prev) => prev.map((p) => ({ ...p, type: "app", selected: false, data: { ...p.data, focused: false } })));
    fitView({ padding: 0.16, duration: 480 });
  }, [fitView, setNodes]);

  const edges = useMemo(() => EDGES_RAW.map((e) => ({
    id: e.id, source: e.source, target: e.target, label: opLabel(e.op, dataMode),
    style: { stroke: opColor[e.op], strokeWidth: 1.6, strokeDasharray: e.dash },
    markerEnd: { type: MarkerType.ArrowClosed, color: opColor[e.op], width: 15, height: 15 },
    labelBgStyle: { fill: C.panel, fillOpacity: 0.96 }, labelBgPadding: [5, 3] as [number, number], labelBgBorderRadius: 5,
    labelStyle: { fill: C.text2, fontFamily: MONO, fontSize: 10 },
  })), [dataMode]);

  const seg = (on: boolean) => ({ cursor: "pointer", fontFamily: UI, fontSize: 11.5, fontWeight: 600, padding: "5px 12px", borderRadius: 7, border: "none", background: on ? C.card : "transparent", color: on ? C.text : C.text3, boxShadow: on ? "0 1px 2px rgba(0,0,0,0.4)" : "none" });

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.base, fontFamily: UI }}>
      {/* Top bar: breadcrumb + decorative actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 14px", height: 44, flexShrink: 0, background: C.panel, borderBottom: `1px solid ${C.borderSub}` }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text2 }}>My Flows</span>
        <span style={{ color: C.text3, fontSize: 12 }}>›</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>Twitter scanner</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 999, padding: "4px 11px" }}>↻ Regenerate</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.base, background: C.accent, borderRadius: 999, padding: "4px 11px" }}>+ Add Triggers</span>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Side panel */}
        <div style={{ width: 210, flexShrink: 0, background: C.panel, borderRight: `1px solid ${C.borderSub}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <button onClick={back} style={{ display: "flex", alignItems: "center", gap: 7, margin: 10, padding: "8px 10px", cursor: "pointer", background: "transparent", border: "none", borderRadius: 8, fontFamily: UI, fontSize: 12.5, fontWeight: 600, color: C.text2, textAlign: "left" }}>← Back to My Flows</button>
          <div style={{ height: 1, background: C.borderSub }} />
          <div style={{ padding: "10px 12px 4px", fontFamily: MONO, fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.12em", color: C.text3 }}>In this flow</div>
          <div style={{ overflowY: "auto", padding: "0 8px 10px" }}>
            {GROUPS.map((g) => (
              <div key={g.label} style={{ marginBottom: 6 }}>
                <div style={{ padding: "6px 6px 4px", fontFamily: MONO, fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.1em", color: C.text3 }}>{g.label}</div>
                {g.ids.map((id) => {
                  const n = NODES.find((x) => x.id === id)!;
                  const on = focused === id;
                  return (
                    <button key={id} onClick={() => focusNode(id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", cursor: "pointer", textAlign: "left", border: "none", borderRadius: 7, background: on ? C.active : "transparent", fontFamily: n.data.code ? MONO : UI }}>
                      <span style={{ flexShrink: 0, width: 16, display: "flex", justifyContent: "center" }}>
                        {n.data.logo ? <img src={n.data.logo} width={14} height={14} alt="" /> : <FileGlyph s={13} c={on ? C.text : C.text3} />}
                      </span>
                      <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: n.data.code ? 11 : 12.5, color: on ? C.text : C.text2 }}>{n.data.title}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, n) => focusNode(n.id)}
            onPaneClick={back}
            onInit={(i) => i.fitView({ padding: 0.16 })}
            fitView
            fitViewOptions={{ padding: 0.16 }}
            minZoom={0.4}
            maxZoom={2.4}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
            style={{ background: C.base }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(237,230,215,0.06)" />
          </ReactFlow>

          {/* Mode toggle (top-left) */}
          <div style={{ position: "absolute", left: 12, top: 12, zIndex: 10, display: "flex", gap: 3, padding: 2, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 9, boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>
            <button style={seg(!dataMode)} onClick={() => setDataMode(false)}>Agent Flow</button>
            <button style={seg(dataMode)} onClick={() => setDataMode(true)}>Data Flow</button>
          </div>

          {/* Back affordance when focused */}
          {focused && (
            <button onClick={back} style={{ position: "absolute", left: 12, top: 56, zIndex: 10, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: UI, fontSize: 12, fontWeight: 500, color: C.text2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 999, padding: "6px 12px" }}>← Back to graph</button>
          )}

          {/* Legend (top-right) */}
          <div style={{ position: "absolute", right: 12, top: 12, zIndex: 10, display: "flex", alignItems: "center", gap: 2, padding: "4px 5px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 999, boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>
            {(["read", "write", "run"] as Op[]).map((op) => (
              <span key={op} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px" }}>
                <svg width="22" height="6"><line x1="1" y1="3" x2="18" y2="3" stroke={opColor[op]} strokeWidth="1.6" strokeLinecap="round" /></svg>
                <span style={{ fontFamily: MONO, fontSize: 9, color: C.text2 }}>{opLabel(op, dataMode)}</span>
              </span>
            ))}
          </div>

          {/* Zoom controls (bottom-right) */}
          <ZoomBar />

          {/* Status strip */}
          <div style={{ position: "absolute", inset: "auto 0 0 0", height: 26, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "rgba(27,23,18,0.85)", borderTop: `1px solid ${C.borderSub}`, zIndex: 10, pointerEvents: "none", fontFamily: MONO, fontSize: 10, color: C.text3 }}>
            <span>● No active triggers</span>
            <span>5 nodes · 4 connections</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZoomBar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const btn = { width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: C.text2, fontSize: 16 } as const;
  return (
    <div style={{ position: "absolute", right: 12, bottom: 36, zIndex: 10, display: "flex", flexDirection: "column", background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>
      <button style={btn} onClick={() => zoomIn()}>+</button>
      <button style={{ ...btn, borderTop: `1px solid ${C.borderSub}` }} onClick={() => zoomOut()}>−</button>
      <button style={{ ...btn, borderTop: `1px solid ${C.borderSub}`, fontSize: 12 }} onClick={() => fitView({ padding: 0.16 })}>⤢</button>
    </div>
  );
}

export default function MockGraph() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}

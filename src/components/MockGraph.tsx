import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  applyNodeChanges,
  type Node,
  type NodeProps,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/* A faithful, mostly-mocked replica of ShoFlow's open-flow view for the landing
 * hero. The flow is REAL: two scheduled jobs (twitter-feed-scanner, article-writer),
 * their instruction files, the content-research-writer skill, and the connected
 * apps — derived from actual ShoFlow flows. Node colours, the readable schedule,
 * and the header Edit / Show-downstream affordances mirror the app's FlowNodeCard /
 * ExpandedFlowNode. The expanded trigger nodes embed the app's genuine Mermaid
 * flowcharts (pre-rendered to static SVG; no mermaid runtime dependency). Node
 * focus shows ONLY the node + its direct neighbours (inputs-left / node-centre /
 * outputs-right), exactly like FlowCanvas. Real: zoom/pan/drag/fit, the "In this
 * flow" navigation, node focus, mode toggle. Mocked (inert): Regenerate / Add
 * Triggers / Edit / Show downstream. */

// Dark-theme design tokens (mirror src/index.css :root in the app).
const C = {
  base: "#15120F", surface: "#1B1712", card: "#2A241D", chip: "#332C23", active: "#332C23",
  border: "rgba(237,230,215,0.12)", borderSub: "rgba(237,230,215,0.06)",
  text: "#EDE6D7", text2: "#A79D8C", text3: "#6E6557",
  accent: "#E85D42", accentSub: "rgba(232,93,66,0.14)",
  success: "#6FD17A",
  // top-level graph edges (--edge-*)
  eRead: "#7C93A6", eWrite: "#8FA083", eRun: "#E85D42", eCreate: "#6DBAA1",
  // node-type tints (--file-doc / --node-skill / --accent)
  fileDoc: "#7C93A6", fileDocSub: "rgba(124,147,166,0.16)",
  skill: "#C9A35E", skillSub: "rgba(201,163,94,0.16)",
};
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const UI = '"Inter Variable", Inter, system-ui, sans-serif';

type Op = "read" | "write" | "run" | "create";
type Kind = "trigger" | "file" | "app" | "skill";
const edgeColor: Record<Op, string> = { read: C.eRead, write: C.eWrite, run: C.eRun, create: C.eCreate };
const edgeDash: Record<Op, string | undefined> = { run: "5 5", read: "1.5 6", write: undefined, create: undefined };

interface GNode {
  id: string; kind: Kind; eyebrow: string; title: string; code?: boolean;
  logo?: string; desc?: string; connector?: string; schedule?: string; model?: string;
  svg?: string; flowH?: number;
}
interface NData extends GNode { svgContent?: string; focused?: boolean; [k: string]: unknown }

/* ── The real content-generation flow ───────────────────────────────────── */
const GN: GNode[] = [
  { id: "twitter", kind: "trigger", eyebrow: "Claude Task", title: "Scan Twitter Feed", schedule: "Every 6 hours", model: "Opus 4.8",
    desc: "Scans Twitter/X for high-signal AI tweets, scores them, and logs qualifying items to Sheets.", svg: "twitter-feed-scanner", flowH: 560 },
  { id: "writer", kind: "trigger", eyebrow: "Claude Task", title: "Draft Article", schedule: "Daily at 9am", model: "Opus 4.8",
    desc: "Picks a topic from the Twitter log, researches it, and drafts a finished article.", svg: "article-writer", flowH: 660 },
  { id: "identity", kind: "file", eyebrow: "File", title: "user-identity.md", code: true,
    desc: "Author identity, relevance criteria, and topic preferences." },
  { id: "voice", kind: "file", eyebrow: "File", title: "voice.md", code: true,
    desc: "Writing voice, tone, and platform style rules." },
  { id: "skill", kind: "skill", eyebrow: "Skill", title: "content-research-writer", code: true,
    desc: "Researches a topic and drafts a long-form article in the author's voice." },
  { id: "chrome", kind: "app", eyebrow: "Google Chrome", title: "Twitter / X research", logo: "/brand/chrome.svg",
    desc: "Verify session, scan Tier-1 profiles, run search queries." },
  { id: "sheets", kind: "app", eyebrow: "Google Sheets", title: "Rolling 30-day Twitter log", logo: "/brand/googlesheets.svg",
    desc: "Shared log — the scanner writes it, the writer reads it.", connector: "MCP · 14 tools" },
  { id: "telegram", kind: "app", eyebrow: "Telegram", title: "Alerts", logo: "/brand/telegram.svg",
    desc: "Session-expiry and failure alerts.", connector: "MCP · 6 tools" },
];
const NODE_BY_ID: Record<string, GNode> = Object.fromEntries(GN.map((n) => [n.id, n]));

const GE: { source: string; target: string; op: Op }[] = [
  { source: "twitter", target: "identity", op: "read" },
  { source: "twitter", target: "voice", op: "read" },
  { source: "twitter", target: "chrome", op: "run" },
  { source: "twitter", target: "sheets", op: "write" },
  { source: "twitter", target: "telegram", op: "write" },
  { source: "writer", target: "identity", op: "read" },
  { source: "writer", target: "voice", op: "read" },
  { source: "writer", target: "skill", op: "read" },
  { source: "writer", target: "sheets", op: "read" },
  { source: "writer", target: "chrome", op: "run" },
];

const POS: Record<string, { x: number; y: number }> = {
  twitter: { x: 40, y: 150 }, writer: { x: 40, y: 470 },
  identity: { x: 470, y: 40 }, voice: { x: 470, y: 200 }, chrome: { x: 470, y: 360 },
  skill: { x: 850, y: 110 }, sheets: { x: 850, y: 320 }, telegram: { x: 850, y: 500 },
};

const GROUPS: { label: string; ids: string[] }[] = [
  { label: "Triggers", ids: ["twitter", "writer"] },
  { label: "Files", ids: ["identity", "voice"] },
  { label: "Skills", ids: ["skill"] },
  { label: "Connected apps", ids: ["chrome", "sheets", "telegram"] },
];

/* ── centeredLayout — ported from the app (flowLayout.ts) ────────────────── */
const NW = 295, NH = 104, COL_GAP = 150, STACK = 26;
const colH = (c: number) => (c === 0 ? 0 : c * NH + (c - 1) * STACK);
function centeredLayout(focusedId: string, inputs: string[], outputs: string[], fW: number, fH: number) {
  const totalH = Math.max(colH(inputs.length), colH(outputs.length), fH);
  const focusedX = inputs.length ? NW + COL_GAP : 0;
  const outputsX = focusedX + fW + COL_GAP;
  const place = (list: string[], x: number) => {
    const top = (totalH - colH(list.length)) / 2;
    return list.map((id, i) => ({ id, x, y: top + i * (NH + STACK) }));
  };
  return [
    ...place(inputs, 0),
    { id: focusedId, x: focusedX, y: (totalH - fH) / 2 },
    ...place(outputs, outputsX),
  ];
}

const EXPANDABLE = new Set<Kind>(["trigger", "file", "skill"]);
const hasFlow = (n: GNode) => !!n.svg;
const shouldExpand = (n: GNode) => EXPANDABLE.has(n.kind);

// Per-type icon-block tint + eyebrow colour (mirrors nodeVisual()).
function visual(n: GNode): { color: string; subtle: string } {
  if (n.kind === "trigger") return { color: C.accent, subtle: C.accentSub };
  if (n.kind === "skill") return { color: C.skill, subtle: C.skillSub };
  if (n.kind === "file") return { color: C.fileDoc, subtle: C.fileDocSub };
  return { color: C.text2, subtle: C.chip };
}

/* ── Glyphs ──────────────────────────────────────────────────────────────── */
const g = (s: number, c: string) => ({ width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });
// lucide-react FileText (v1.17.0) — the exact icon the app uses for .md file nodes.
const FileGlyph = ({ s = 32, c = C.fileDoc }: { s?: number; c?: string }) => (
  <svg {...g(s, c)}>
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
    <path d="M14 2v5a1 1 0 0 0 1 1h5" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </svg>
);
const SparkGlyph = ({ s = 32, c = C.skill }: { s?: number; c?: string }) => (
  <svg {...g(s, c)}><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" /><path d="M19 14l.8 2M5 17l.7 1.7" /></svg>
);
const ClockGlyph = ({ s = 32, c = C.accent }: { s?: number; c?: string }) => (
  <svg {...g(s, c)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const PencilGlyph = ({ s = 13, c = C.text2 }: { s?: number; c?: string }) => (
  <svg {...g(s, c)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);
const NetworkGlyph = ({ s = 13, c = C.text2 }: { s?: number; c?: string }) => (
  <svg {...g(s, c)}><rect x="9" y="2" width="6" height="6" rx="1" /><rect x="3" y="16" width="6" height="6" rx="1" /><rect x="15" y="16" width="6" height="6" rx="1" /><path d="M12 8v4M12 12H6v4M12 12h6v4" /></svg>
);
// Anthropic / Claude burst mark (model logo) — approximate, coral.
const ClaudeGlyph = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={C.accent}>
    <path d="M12 2l1.4 6.1L19 5.5l-3.4 5L22 12l-6.4 1.5L19 18.5l-5.6-2.6L12 22l-1.4-6.1L5 18.5l3.4-5L2 12l6.4-1.5L5 5.5l5.6 2.6Z" />
  </svg>
);

function NodeIcon({ n, size }: { n: GNode; size?: number }) {
  if (n.logo) return <img src={n.logo} alt="" width={size ?? 32} height={size ?? 32} style={{ objectFit: "contain" }} />;
  if (n.kind === "skill") return <SparkGlyph s={size} />;
  if (n.kind === "trigger") return <ClockGlyph s={size} />;
  return <FileGlyph s={size} />;
}
function MiniIcon({ n, on }: { n: GNode; on: boolean }) {
  if (n.logo) return <img src={n.logo} width={14} height={14} alt="" />;
  const c = on ? visual(n).color : C.text3;
  if (n.kind === "skill") return <SparkGlyph s={13} c={c} />;
  if (n.kind === "trigger") return <ClockGlyph s={13} c={c} />;
  return <FileGlyph s={13} c={c} />;
}

const handleStyle = { width: 7, height: 7, background: C.text2, border: `2px solid ${C.card}` };

// ShoFlow mark (mirrors src/components/Logo.tsx — themes via currentColor).
function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ display: "block" }}>
      <path d="M9.5 30.5 L16 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 16 L30.5 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="7" cy="33" r="3.2" fill="currentColor" />
      <circle cx="33" cy="7" r="3.2" fill="currentColor" />
      <circle cx="20" cy="20" r="8.4" stroke="currentColor" strokeWidth="2.4" />
      <path d="M17.4 16.3 L24 20 L17.4 23.7 Z" fill="#E85D42" />
    </svg>
  );
}

function TriggerMeta({ schedule, model }: { schedule?: string; model?: string }) {
  return (
    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "3px 8px", fontFamily: MONO, fontSize: 10.5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: C.success, flexShrink: 0 }} />
      {schedule && <span style={{ color: C.text2 }}>{schedule}</span>}
      {schedule && model && <span style={{ color: C.text3 }}>·</span>}
      {model && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: C.text2 }}><ClaudeGlyph /> {model}</span>}
    </div>
  );
}

/* ── Collapsed card ──────────────────────────────────────────────────────── */
function FlowCard({ data }: NodeProps & { data: NData }) {
  const vis = visual(data);
  const isTrigger = data.kind === "trigger";
  return (
    <div style={{ width: NW, display: "flex", background: C.card, borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.36)", border: `1px solid ${C.border}` }}>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -2 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -2 }} />
      <div style={{ width: 54, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: vis.subtle, borderRight: `1px solid ${C.borderSub}` }}><NodeIcon n={data} /></div>
      <div style={{ minWidth: 0, flex: 1, padding: "11px 13px 12px" }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: isTrigger ? 600 : 500, textTransform: "uppercase", letterSpacing: "0.13em", color: vis.color }}>{data.eyebrow}</div>
        <div style={{ marginTop: 1, fontWeight: 700, fontSize: data.code ? 12.5 : 15, color: C.text, lineHeight: 1.25, fontFamily: data.code ? MONO : UI, letterSpacing: "-0.01em", wordBreak: data.code ? "break-all" : "normal", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{data.title}</div>
        {data.desc && !isTrigger && <div style={{ marginTop: 4, fontSize: 12, color: C.text2, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{data.desc}</div>}
        {/* MCP connector chip — only in the node-centered view, like the app. */}
        {data.connector && data.focused && (
          <button onClick={(e) => e.stopPropagation()} style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: MONO, fontSize: 10, color: C.text2, background: C.base, border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 8px" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: C.success }} /> {data.connector}
          </button>
        )}
        {isTrigger && <TriggerMeta schedule={data.schedule} model={data.model} />}
      </div>
    </div>
  );
}

/* ── Ghost button (header actions) ───────────────────────────────────────── */
function Ghost({ children }: { children: ReactNode }) {
  return (
    <button onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, cursor: "pointer", fontFamily: UI, fontSize: 12, fontWeight: 500, color: C.text2, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px" }}>
      {children}
    </button>
  );
}

/* ── Expanded (focused) node ─────────────────────────────────────────────── */
function ExpandedNode({ data }: NodeProps & { data: NData }) {
  const flow = hasFlow(data);
  const isTrigger = data.kind === "trigger";
  const vis = visual(data);
  const w = flow ? 600 : 380;
  return (
    <div style={{ width: w, background: C.card, borderRadius: 10, overflow: "hidden", boxShadow: "0 18px 48px rgba(0,0,0,0.46)", border: `1.5px solid ${C.accent}` }}>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -2 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -2 }} />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", borderBottom: `1px solid ${C.borderSub}`, background: C.surface }}>
        <div style={{ width: 36, height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: vis.subtle, borderRadius: 10 }}><NodeIcon n={data} size={20} /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.12em", color: vis.color }}>{data.eyebrow}</div>
          <div style={{ fontWeight: 700, fontSize: data.code ? 13 : 15, color: C.text, fontFamily: data.code ? MONO : UI, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.title}</div>
        </div>
        {isTrigger && data.schedule && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, fontFamily: MONO, fontSize: 10, color: C.text2 }}><ClockGlyph s={12} c={C.text2} /> {data.schedule}</span>}
        {data.model && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, fontFamily: MONO, fontSize: 10, color: C.text2, background: C.chip, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 7px" }}><ClaudeGlyph /> {data.model}</span>}
        {flow && <Ghost><NetworkGlyph /> Hide downstream</Ghost>}
        <Ghost><PencilGlyph /> Edit</Ghost>
      </div>
      {/* Description */}
      {data.desc && (
        <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.borderSub}`, background: C.surface, fontSize: 12, lineHeight: 1.4, color: C.text2 }}>{data.desc}</div>
      )}
      {/* In-node flow */}
      {flow ? (
        data.svgContent ? (
          <div className="mflow" style={{ width: "100%" }} dangerouslySetInnerHTML={{ __html: data.svgContent }} />
        ) : (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: C.text3, fontFamily: MONO, fontSize: 11 }}>rendering…</div>
        )
      ) : (
        <div style={{ padding: "10px 14px", fontSize: 12, fontStyle: "italic", color: C.text3 }}>
          No workflow steps detected in this file — it reads as reference material.
        </div>
      )}
    </div>
  );
}

const nodeTypes = { card: FlowCard, expanded: ExpandedNode };

const edgeLabel = (op: Op, data: boolean) =>
  data ? ({ read: "Input", write: "Output", run: "Run", create: "Output" }[op]) : (op[0].toUpperCase() + op.slice(1));

function Inner() {
  const { fitView } = useReactFlow();
  const [mode, setMode] = useState<"agent" | "data">("agent");
  const [focused, setFocused] = useState<string | null>(null);
  const [svgs, setSvgs] = useState<Record<string, string>>({});
  const [nodes, setNodes] = useState<Node<NData>[]>([]);
  const fitRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(
      // ?v bumps when the pre-rendered SVGs change, so browsers never serve a stale flowchart.
      GN.filter((n) => n.svg).map((n) =>
        fetch(`/flowcharts/${n.svg}.svg?v=8`).then((r) => r.text()).then((t) => [n.svg!, t] as const).catch(() => [n.svg!, ""] as const)),
    ).then((pairs) => { if (alive) setSvgs(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, []);

  const dataMode = focused != null || mode === "data";

  useEffect(() => {
    const build = (id: string, type: "card" | "expanded", pos: { x: number; y: number }): Node<NData> => {
      const node = NODE_BY_ID[id];
      return { id, type, position: pos, selected: id === focused,
        data: { ...node, focused: id === focused, svgContent: node.svg ? svgs[node.svg] : undefined } };
    };
    let next: Node<NData>[];
    if (!focused) {
      next = GN.map((n) => build(n.id, "card", POS[n.id]));
    } else {
      const f = NODE_BY_ID[focused];
      const incident = GE.filter((e) => e.source === focused || e.target === focused);
      const inputs = incident.filter((e) => e.target === focused).map((e) => e.source);
      const outputs = incident.filter((e) => e.source === focused).map((e) => e.target);
      const expand = shouldExpand(f);
      const fW = expand ? (hasFlow(f) ? 600 : 380) : NW;
      const fH = expand ? (hasFlow(f) ? f.flowH ?? 560 : 200) : 132;
      const placed = centeredLayout(focused, inputs, outputs, fW, fH);
      next = placed.map((p) => build(p.id, p.id === focused && expand ? "expanded" : "card", { x: p.x, y: p.y }));
    }
    setNodes(next);
    if (fitRef.current) window.clearTimeout(fitRef.current);
    fitRef.current = window.setTimeout(() => fitView({ padding: focused ? 0.2 : 0.14, duration: 460, maxZoom: 1.5 }), 70);
  }, [focused, svgs, fitView]);

  const onNodesChange = useCallback((ch: NodeChange<Node<NData>>[]) => setNodes((nds) => applyNodeChanges(ch, nds)), []);

  const edges = useMemo(() => {
    const list = focused ? GE.filter((e) => e.source === focused || e.target === focused) : GE;
    return list.map((e, i) => ({
      id: `e-${i}`, source: e.source, target: e.target, animated: e.op === "run",
      label: edgeLabel(e.op, dataMode),
      style: { stroke: edgeColor[e.op], strokeWidth: e.op === "run" ? 2.4 : 2.1, strokeDasharray: edgeDash[e.op] },
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor[e.op], width: 14, height: 14 },
      labelBgStyle: { fill: C.surface, fillOpacity: 0.95 }, labelBgPadding: [5, 3] as [number, number], labelBgBorderRadius: 5,
      labelStyle: { fill: C.text2, fontFamily: MONO, fontSize: 9.5 },
    }));
  }, [focused, dataMode]);

  const back = useCallback(() => setFocused(null), []);
  const seg = (on: boolean) => ({ cursor: "pointer", fontFamily: UI, fontSize: 11.5, fontWeight: 600, padding: "5px 12px", borderRadius: 7, border: "none", background: on ? C.card : "transparent", color: on ? C.text : C.text3, boxShadow: on ? "0 1px 2px rgba(0,0,0,0.4)" : "none" });
  const presentOps: Op[] = ["read", "write", "run"];

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.base, fontFamily: UI }}>
      {/* React Flow defaults nodes to text-align:center; the app's cards are left-aligned. */}
      <style>{`.mflow svg{width:100%!important;height:auto!important;max-width:100%!important;} .react-flow__node{text-align:left;}`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 48, flexShrink: 0, background: C.base, borderBottom: `1px solid ${C.border}` }}>
        {/* faux macOS traffic lights */}
        <div style={{ display: "flex", gap: 7, marginRight: 4 }}>
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#ED6A5E" }} />
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#F4BE4F" }} />
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#61C554" }} />
        </div>
        {/* ShoFlow logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.text }}>
          <LogoMark size={24} />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: C.text }}>Sho<span style={{ color: C.accent, fontStyle: "italic", fontFamily: "Newsreader, Georgia, serif" }}>f </span>low</span>
        </div>
        {/* breadcrumb */}
        <span style={{ color: C.text3, fontSize: 13, marginLeft: 2 }}>›</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text2 }}>My Flows</span>
        <span style={{ color: C.text3, fontSize: 12 }}>›</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>Article Writer</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 999, padding: "5px 12px" }}>↻ Regenerate Flow</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.base, background: C.accent, borderRadius: 999, padding: "5px 12px" }}>+ Add Triggers</span>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ width: 214, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.borderSub}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <button onClick={back} style={{ display: "flex", alignItems: "center", gap: 7, margin: 10, marginBottom: 4, padding: "8px 10px", cursor: "pointer", background: "transparent", border: "none", borderRadius: 8, fontFamily: UI, fontSize: 12.5, fontWeight: 600, color: C.text2, textAlign: "left" }}>← Back to My Flows</button>
          <div style={{ height: 1, background: C.borderSub }} />
          <div style={{ padding: "11px 12px 4px", fontFamily: MONO, fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.12em", color: C.text3 }}>In this flow</div>
          <div style={{ overflowY: "auto", padding: "0 8px 10px" }}>
            {GROUPS.map((grp) => (
              <div key={grp.label} style={{ marginBottom: 6 }}>
                <div style={{ padding: "6px 6px 4px", fontFamily: MONO, fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.1em", color: C.text3 }}>{grp.label}</div>
                {grp.ids.map((id) => {
                  const n = NODE_BY_ID[id];
                  const on = focused === id;
                  return (
                    <button key={id} onClick={() => setFocused(id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", cursor: "pointer", textAlign: "left", border: "none", borderRadius: 7, background: on ? C.active : "transparent" }}>
                      <span style={{ flexShrink: 0, width: 16, display: "flex", justifyContent: "center" }}><MiniIcon n={n} on={on} /></span>
                      <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: n.code ? MONO : UI, fontSize: n.code ? 11 : 12.5, color: on ? C.text : C.text2 }}>{n.title}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, n) => setFocused(n.id)}
            onPaneClick={back}
            minZoom={0.2}
            maxZoom={2.4}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
            style={{ background: C.base }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(237,230,215,0.06)" />
          </ReactFlow>

          {focused ? (
            <button onClick={back} style={{ position: "absolute", left: 12, top: 12, zIndex: 10, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: UI, fontSize: 12, fontWeight: 500, color: C.text2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 999, padding: "6px 13px 6px 11px", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>← Back to graph</button>
          ) : (
            <div style={{ position: "absolute", left: 12, top: 12, zIndex: 10, display: "flex", gap: 3, padding: 2, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>
              <button style={seg(mode === "agent")} onClick={() => setMode("agent")}>Agent Flow</button>
              <button style={seg(mode === "data")} onClick={() => setMode("data")}>Data Flow</button>
            </div>
          )}

          {!focused && (
            <div style={{ position: "absolute", right: 12, top: 12, zIndex: 10, display: "flex", alignItems: "center", gap: 2, padding: "4px 5px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 999, boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>
              {presentOps.map((op) => (
                <span key={op} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px" }}>
                  <svg width="22" height="6"><line x1="1" y1="3" x2="18" y2="3" stroke={edgeColor[op]} strokeWidth="1.8" strokeLinecap="round" strokeDasharray={edgeDash[op]} /></svg>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: C.text2 }}>{edgeLabel(op, mode === "data")}</span>
                </span>
              ))}
            </div>
          )}

          <ZoomBar />

          <div style={{ position: "absolute", inset: "auto 0 0 0", height: 26, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "rgba(27,23,18,0.85)", borderTop: `1px solid ${C.borderSub}`, zIndex: 10, pointerEvents: "none", fontFamily: MONO, fontSize: 10, color: C.text3 }}>
            <span style={{ color: C.success }}>● 2 scheduled jobs</span>
            <span>{GN.length} nodes · {GE.length} connections</span>
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
      <button style={{ ...btn, borderTop: `1px solid ${C.borderSub}`, fontSize: 12 }} onClick={() => fitView({ padding: 0.14 })}>⤢</button>
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

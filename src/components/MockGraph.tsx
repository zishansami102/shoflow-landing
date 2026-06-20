import { useCallback, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/* An interactive, mocked replica of ShoFlow's "My Flows" graph for the landing
 * hero. Real React Flow engine (zoom / pan / drag / fit + click-to-focus); the
 * data is static and the toolbar buttons are decorative. Styled with ShoFlow's
 * dark (cocoa) theme so it reads as the actual app. */

// Dark-theme tokens (mirrors src/index.css :root in the app).
const C = {
  base: "#15120F",
  panel: "#1B1712",
  card: "#2A241D",
  chip: "#241E18",
  border: "rgba(237,230,215,0.12)",
  borderSub: "rgba(237,230,215,0.07)",
  text: "#EDE6D7",
  text2: "#A79D8C",
  text3: "#6E6557",
  accent: "#E85D42",
  accentSub: "rgba(232,93,66,0.16)",
  read: "#6BA3BE",
  write: "#8FA083",
  run: "#D4845A",
};
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const UI = '"Inter Variable", Inter, system-ui, sans-serif';

const FileGlyph = ({ color = C.text2 }: { color?: string }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
  </svg>
);

type AppNodeData = {
  eyebrow: string;
  title: string;
  desc?: string;
  logo?: string;
  tint?: string;
  code?: boolean;
};

const handleStyle = { width: 7, height: 7, background: C.text3, border: `2px solid ${C.card}` };

function AppNode({ data, selected }: NodeProps & { data: AppNodeData }) {
  return (
    <div
      style={{
        width: 264,
        display: "flex",
        alignItems: "stretch",
        background: C.card,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: selected ? `0 0 0 2px ${C.accent}, 0 12px 36px rgba(0,0,0,0.45)` : "0 8px 28px rgba(0,0,0,0.38)",
        border: `1px solid ${selected ? C.accent : C.border}`,
        transition: "box-shadow .15s, border-color .15s",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -2 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -2 }} />
      <div style={{ width: 50, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: data.tint ?? C.chip, borderRight: `1px solid ${C.borderSub}` }}>
        {data.logo ? <img src={data.logo} alt="" width={32} height={32} style={{ objectFit: "contain" }} /> : <FileGlyph />}
      </div>
      <div style={{ minWidth: 0, flex: 1, padding: "10px 12px 11px" }}>
        <div style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.13em", color: C.text3 }}>{data.eyebrow}</div>
        <div style={{ marginTop: 1, fontWeight: 700, fontSize: data.code ? 12 : 14.5, color: C.text, lineHeight: 1.22, fontFamily: data.code ? MONO : UI, letterSpacing: "-0.01em" }}>{data.title}</div>
        {data.desc && (
          <div style={{ marginTop: 4, fontSize: 11.5, color: C.text2, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{data.desc}</div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { app: AppNode };

const INITIAL_NODES: Node<AppNodeData>[] = [
  { id: "src", type: "app", position: { x: 40, y: 250 }, data: { eyebrow: "File", title: "TWITTER-GUIDELINES.md", code: true, desc: "Scans Twitter/X for high-signal AI tweets, filters and scores them, logs qualifying…" } },
  { id: "voice", type: "app", position: { x: 470, y: 40 }, data: { eyebrow: "File", title: "voice.md", code: true, desc: "Defines the writing voice, tone, and platform-specific style rules." } },
  { id: "chrome", type: "app", position: { x: 470, y: 190 }, data: { eyebrow: "Google Chrome", title: "Twitter / X profiles", logo: "/brand/chrome.svg", desc: "Verify Twitter session and scan Tier-1 profiles in Chrome." } },
  { id: "sheets", type: "app", position: { x: 470, y: 340 }, data: { eyebrow: "Google Sheets", title: "Rolling 30-day Twitter log", logo: "/brand/googlesheets.svg", desc: "Log qualifying tweets to the rolling 30-day Twitter log." } },
  { id: "telegram", type: "app", position: { x: 470, y: 490 }, data: { eyebrow: "Telegram", title: "Telegram alerts", logo: "/brand/telegram.svg", desc: "Send a session-expiry or failure alert." } },
];

const edge = (id: string, source: string, target: string, label: string, color: string, dash?: string) => ({
  id, source, target, label,
  style: { stroke: color, strokeWidth: 1.6, strokeDasharray: dash },
  markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
  labelBgStyle: { fill: C.panel, fillOpacity: 0.95 },
  labelBgPadding: [5, 3] as [number, number],
  labelBgBorderRadius: 5,
  labelStyle: { fill: C.text2, fontFamily: MONO, fontSize: 10 },
});

const INITIAL_EDGES = [
  edge("e1", "src", "voice", "Read", C.read, "4 3"),
  edge("e2", "src", "chrome", "Run", C.run, "5 4"),
  edge("e3", "src", "sheets", "Write", C.write),
  edge("e4", "src", "telegram", "Write", C.write),
];

function Canvas() {
  const [nodes, , onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [focused, setFocused] = useState<string | null>(null);
  const { setCenter, fitView } = useReactFlow();

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setFocused(node.id);
    setCenter(node.position.x + 132, node.position.y + 42, { zoom: 1.55, duration: 480 });
  }, [setCenter]);

  const backToGraph = useCallback(() => {
    setFocused(null);
    fitView({ padding: 0.18, duration: 480 });
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={backToGraph}
      onInit={(inst) => inst.fitView({ padding: 0.18 })}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.4}
      maxZoom={2.5}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
      style={{ background: C.base }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(237,230,215,0.06)" />

      {/* Top bar — mimics the app chrome (decorative). */}
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 12px", background: "rgba(21,18,15,0.72)", backdropFilter: "blur(6px)", borderBottom: `1px solid ${C.borderSub}`, zIndex: 10, pointerEvents: "none" }}>
        <span style={{ fontFamily: UI, fontSize: 12.5, fontWeight: 600, color: C.text2 }}>My Flows</span>
        <span style={{ color: C.text3, fontSize: 12 }}>›</span>
        <span style={{ fontFamily: UI, fontSize: 12.5, fontWeight: 600, color: C.text }}>Twitter scanner</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: UI, fontSize: 11.5, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 999, padding: "4px 10px" }}>Regenerate</span>
        <span style={{ fontFamily: UI, fontSize: 11.5, fontWeight: 600, color: C.base, background: C.accent, borderRadius: 999, padding: "4px 10px" }}>+ Add Triggers</span>
      </div>

      {/* Back-to-graph affordance when a node is focused. */}
      {focused && (
        <button
          onClick={backToGraph}
          style={{ position: "absolute", left: 12, top: 56, zIndex: 10, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: UI, fontSize: 12, fontWeight: 500, color: C.text2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 999, padding: "6px 12px" }}
        >
          ← Back to graph
        </button>
      )}

      {/* Status strip. */}
      <div style={{ position: "absolute", inset: "auto 0 0 0", height: 28, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "rgba(21,18,15,0.72)", backdropFilter: "blur(6px)", borderTop: `1px solid ${C.borderSub}`, zIndex: 10, pointerEvents: "none", fontFamily: MONO, fontSize: 10.5, color: C.text3 }}>
        <span>● No active triggers</span>
        <span>5 nodes · 4 connections</span>
      </div>
    </ReactFlow>
  );
}

export default function MockGraph() {
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
    </div>
  );
}

import { FLOW_SECTIONS, FLOW_EDGES } from "../data/constants";

export default function FlowPanel() {
  const nodeW = 136, nodeH = 52, colW = 220, rowH = 82, padL = 40, padT = 90;
  const allNodes = {};
  FLOW_SECTIONS.forEach((sec, si) => {
    sec.nodes.forEach((n, ni) => {
      allNodes[n.id] = {
        ...n,
        secIdx: si,
        cx: padL + si * colW + nodeW / 2,
        cy: padT + ni * rowH + nodeH / 2,
        x: padL + si * colW,
        y: padT + ni * rowH,
      };
    });
  });

  const maxNodes = Math.max(...FLOW_SECTIONS.map(s => s.nodes.length));
  const svgW = padL + FLOW_SECTIONS.length * colW + 60;
  const svgH = padT + maxNodes * rowH + nodeH + 20;

  const getFill   = (type) => ({ start: '#ECFDF5', end: '#ECFDF5', action: '#F5F3FF', decision: '#FFFBEB', error: '#FEF2F2' }[type] || '#F5F3FF');
  const getStroke = (type) => ({ start: '#059669', end: '#059669', action: '#7C3AED', decision: '#D97706', error: '#DC2626' }[type] || '#7C3AED');

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <span className="font-semibold text-gray-800 text-sm">유저플로우</span>
      </div>
      <div className="flex-1 overflow-auto bg-white"
        style={{ backgroundImage: 'radial-gradient(circle, #E5E7EB 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
        <svg width={svgW} height={svgH}>
          {FLOW_SECTIONS.map((sec, si) => (
            <g key={sec.id}>
              <rect x={padL + si * colW - 10} y={20} width={colW} height={svgH - 30}
                rx={12} fill={sec.color + '08'} stroke={sec.color + '30'} strokeWidth="1" strokeDasharray="5 3" />
              <rect x={padL + si * colW + nodeW / 2 - 44} y={28} width={88} height={24} rx={12} fill={sec.color} />
              <text x={padL + si * colW + nodeW / 2} y={44} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600">
                {sec.label}
              </text>
            </g>
          ))}

          {FLOW_EDGES.map((e, i) => {
            const from = allNodes[e.from], to = allNodes[e.to];
            if (!from || !to) return null;
            const sameCol = from.secIdx === to.secIdx;
            let d, midX, midY;
            if (sameCol) {
              midX = from.cx; midY = (from.y + nodeH + to.y) / 2;
              d = `M${from.cx},${from.y + nodeH} C${from.cx},${midY} ${to.cx},${midY} ${to.cx},${to.y}`;
            } else if (from.secIdx < to.secIdx) {
              midX = (from.x + nodeW + to.x) / 2; midY = (from.cy + to.cy) / 2;
              d = `M${from.x + nodeW},${from.cy} C${midX},${from.cy} ${midX},${to.cy} ${to.x},${to.cy}`;
            } else {
              const loopY = Math.min(from.y, to.y) - 30;
              midX = (from.cx + to.cx) / 2; midY = loopY;
              d = `M${from.cx},${from.y} C${from.cx},${loopY} ${to.cx},${loopY} ${to.cx},${to.y}`;
            }
            const stroke = from.secIdx > to.secIdx ? '#F59E0B' : '#C4B5FD';
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={stroke} strokeWidth="1.5"
                  strokeDasharray={from.secIdx > to.secIdx ? '5 3' : 'none'} />
                {e.label && (
                  <g>
                    <rect x={midX - 18} y={midY - 8} width={36} height={14} rx={4}
                      fill="white" stroke={stroke + '60'} strokeWidth="0.5" />
                    <text x={midX} y={midY + 3} textAnchor="middle" fill="#7C3AED" fontSize="9" fontFamily="monospace">
                      {e.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {Object.values(allNodes).map(n => {
            const fill = getFill(n.type), stroke = getStroke(n.type);
            if (n.type === 'decision') {
              const hw = nodeW / 2 - 4, hh = nodeH / 2;
              return (
                <g key={n.id}>
                  <polygon
                    points={`${n.cx},${n.cy - hh} ${n.cx + hw},${n.cy} ${n.cx},${n.cy + hh} ${n.cx - hw},${n.cy}`}
                    fill={fill} stroke={stroke + '60'} strokeWidth="1" />
                  {n.label.split('\n').map((l, li) => (
                    <text key={li} x={n.cx} y={n.cy - 4 + li * 13} textAnchor="middle" fill="#92400E" fontSize="10">{l}</text>
                  ))}
                </g>
              );
            }
            if (n.type === 'start' || n.type === 'end') {
              return (
                <g key={n.id}>
                  <rect x={n.x} y={n.y} width={nodeW} height={nodeH} rx={nodeH / 2}
                    fill={fill} stroke={stroke + '60'} strokeWidth="1" />
                  {n.label.split('\n').map((l, li) => (
                    <text key={li} x={n.cx} y={n.cy - 4 + li * 14} textAnchor="middle" fill="#065F46" fontSize="10">{l}</text>
                  ))}
                </g>
              );
            }
            return (
              <g key={n.id}>
                <rect x={n.x} y={n.y} width={nodeW} height={nodeH} rx={10}
                  fill={fill} stroke={stroke + '60'} strokeWidth="1" />
                {n.label.split('\n').map((l, li) => (
                  <text key={li} x={n.cx} y={n.cy - 4 + li * 14} textAnchor="middle" fill="#4C1D95" fontSize="10">{l}</text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

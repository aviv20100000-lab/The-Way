'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface WeightLog { id: string; weight_kg: number; logged_at: string; }
interface WeightJourneyProps {
  currentWeight: number | null;
  targetWeight: number;
  weightLogs: WeightLog[];
  startingWeight: number;
}

function WeightChart({ weightLogs, targetWeight }: { weightLogs: WeightLog[]; targetWeight: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || weightLogs.length < 1) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W0 = canvas.offsetWidth, H0 = canvas.offsetHeight;
    canvas.width = W0 * dpr; canvas.height = H0 * dpr;
    ctx.scale(dpr, dpr);
    const W = W0, H = H0;

    const PAD = { top: 24, right: 28, bottom: 40, left: 16 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const logs = [...weightLogs].reverse();
    const weights = logs.map(l => l.weight_kg);
    const allW = [...weights, targetWeight];
    const minW = Math.min(...allW) - 2;
    const maxW = Math.max(...allW) + 2;

    const xOf = (i: number) => PAD.left + (logs.length > 1 ? (i / (logs.length - 1)) : 0.5) * chartW;
    const yOf = (w: number) => PAD.top + chartH - ((w - minW) / (maxW - minW)) * chartH;

    // bg
    ctx.fillStyle = '#0c0f0f';
    ctx.fillRect(0, 0, W, H);

    // subtle horizontal bands
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * chartH;
      const w = minW + ((4 - i) / 4) * (maxW - minW);
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(142,147,121,0.45)';
      ctx.font = `${9 * dpr / dpr}px system-ui`;
      ctx.textAlign = 'right';
      ctx.fillText(w.toFixed(1), W - PAD.right + 24, y + 4);
    }

    // target zone fill
    const targetY = yOf(targetWeight);
    const zoneGrad = ctx.createLinearGradient(0, targetY - 12, 0, targetY + 12);
    zoneGrad.addColorStop(0, 'rgba(195,244,0,0)');
    zoneGrad.addColorStop(0.5, 'rgba(195,244,0,0.06)');
    zoneGrad.addColorStop(1, 'rgba(195,244,0,0)');
    ctx.fillStyle = zoneGrad;
    ctx.fillRect(PAD.left, targetY - 12, chartW, 24);

    // target dashed line
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, targetY);
    ctx.lineTo(W - PAD.right, targetY);
    ctx.strokeStyle = 'rgba(195,244,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // target label pill
    const tLabel = `יעד ${targetWeight}`;
    ctx.font = `bold 9px system-ui`;
    const tW = ctx.measureText(tLabel).width + 10;
    ctx.fillStyle = 'rgba(195,244,0,0.15)';
    roundRect(ctx, PAD.left + 4, targetY - 10, tW, 18, 5);
    ctx.fill();
    ctx.fillStyle = '#c3f400';
    ctx.textAlign = 'left';
    ctx.fillText(tLabel, PAD.left + 9, targetY + 3);

    if (logs.length === 0) return;

    // build smooth path
    const points = logs.map((_, i) => ({ x: xOf(i), y: yOf(weights[i]) }));

    function getCP(p0: {x:number,y:number}, p1: {x:number,y:number}, p2: {x:number,y:number}) {
      const d01 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const d12 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const fa = 0.3 * d01 / (d01 + d12);
      const fb = 0.3 * d12 / (d01 + d12);
      return {
        cp1x: p1.x - fa * (p2.x - p0.x),
        cp1y: p1.y - fa * (p2.y - p0.y),
        cp2x: p1.x + fb * (p2.x - p0.x),
        cp2y: p1.y + fb * (p2.y - p0.y),
      };
    }

    const buildPath = () => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      if (points.length === 1) return;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        const { cp1x, cp1y } = getCP(p0, p1, p2);
        const { cp2x, cp2y } = getCP(p1, p2, p3);
        ctx.bezierCurveTo(
          i === 0 ? p1.x : cp1x, i === 0 ? p1.y : cp1y,
          cp2x, cp2y,
          p2.x, p2.y
        );
      }
    };

    // area fill — deep gradient
    ctx.save();
    buildPath();
    ctx.lineTo(points[points.length - 1].x, PAD.top + chartH);
    ctx.lineTo(points[0].x, PAD.top + chartH);
    ctx.closePath();
    const areaGrad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
    areaGrad.addColorStop(0, 'rgba(195,244,0,0.18)');
    areaGrad.addColorStop(0.5, 'rgba(56,189,248,0.10)');
    areaGrad.addColorStop(1, 'rgba(56,189,248,0.01)');
    ctx.fillStyle = areaGrad;
    ctx.fill();
    ctx.restore();

    // stroke — lime to blue gradient
    const lineGrad = ctx.createLinearGradient(points[0].x, 0, points[points.length - 1].x, 0);
    lineGrad.addColorStop(0, '#c3f400');
    lineGrad.addColorStop(1, '#38bdf8');

    ctx.save();
    buildPath();
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#c3f400';
    ctx.stroke();
    ctx.restore();

    // data points
    points.forEach((p, i) => {
      const isLatest = i === points.length - 1;
      const isLowest = weights[i] === Math.min(...weights);

      // outer glow ring
      ctx.beginPath();
      ctx.arc(p.x, p.y, isLatest ? 11 : 7, 0, Math.PI * 2);
      ctx.fillStyle = isLatest
        ? 'rgba(195,244,0,0.15)'
        : isLowest ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.05)';
      ctx.fill();

      // dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, isLatest ? 5.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isLatest ? '#c3f400' : isLowest ? '#38bdf8' : 'rgba(255,255,255,0.6)';
      ctx.shadowBlur = isLatest ? 14 : 6;
      ctx.shadowColor = isLatest ? '#c3f400' : '#38bdf8';
      ctx.fill();
      ctx.shadowBlur = 0;

      // weight callout above latest point
      if (isLatest) {
        const label = `${weights[i]} ק"ג`;
        ctx.font = `bold 11px system-ui`;
        const lW = ctx.measureText(label).width + 14;
        const lX = Math.min(Math.max(p.x - lW / 2, PAD.left), W - PAD.right - lW);
        const lY = p.y - 36;

        // pill bg
        ctx.fillStyle = 'rgba(195,244,0,0.15)';
        ctx.strokeStyle = 'rgba(195,244,0,0.4)';
        ctx.lineWidth = 1;
        roundRect(ctx, lX, lY, lW, 22, 7);
        ctx.fill();
        ctx.stroke();

        // arrow down
        ctx.beginPath();
        ctx.moveTo(p.x - 4, lY + 22);
        ctx.lineTo(p.x, lY + 28);
        ctx.lineTo(p.x + 4, lY + 22);
        ctx.fillStyle = 'rgba(195,244,0,0.15)';
        ctx.fill();

        ctx.fillStyle = '#c3f400';
        ctx.textAlign = 'center';
        ctx.fillText(label, lX + lW / 2, lY + 15);
      }
    });

    // X axis date labels
    logs.forEach((log, i) => {
      if (logs.length <= 5 || i % Math.max(1, Math.floor(logs.length / 4)) === 0 || i === logs.length - 1) {
        const d = new Date(log.logged_at);
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        ctx.fillStyle = '#8e9379';
        ctx.font = `9px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(label, xOf(i), H - PAD.bottom + 18);
      }
    });

  }, [weightLogs, targetWeight]);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function WeightJourney({ currentWeight, targetWeight, weightLogs, startingWeight }: WeightJourneyProps) {
  const totalToLose = startingWeight - targetWeight;
  const alreadyLost = startingWeight - (currentWeight || startingWeight);
  const pct = totalToLose > 0 ? Math.max(0, Math.min(100, (alreadyLost / totalToLose) * 100)) : 0;
  const remaining = Math.max(0, (currentWeight || startingWeight) - targetWeight);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'התחלה', value: `${startingWeight}`, color: '#8e9379' },
          { label: 'היום', value: `${currentWeight ?? '-'}`, color: '#38bdf8' },
          { label: 'יעד', value: `${targetWeight}`, color: '#c3f400' },
        ].map((s) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-4 text-center" style={{ border: '1px solid #444933' }}
          >
            <p className="text-[10px] text-[#8e9379] uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-2xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-[#8e9379] mt-0.5">ק"ג</p>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl overflow-hidden relative"
        style={{ border: '1px solid #444933', height: '220px' }}
      >
        {weightLogs.length > 0 ? (
          <WeightChart weightLogs={weightLogs} targetWeight={targetWeight} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <span className="text-3xl opacity-30">📊</span>
            <p className="text-[#8e9379] text-sm">שקול את עצמך כדי לראות את הגרף</p>
          </div>
        )}
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card rounded-2xl p-5 space-y-3" style={{ border: '1px solid #444933' }}
      >
        <div className="flex justify-between items-center text-xs">
          <span className="text-white font-bold text-sm">{pct.toFixed(0)}% הושלם</span>
          <span className="text-[#8e9379]">
            {remaining > 0 ? `עוד ${remaining.toFixed(1)} ק"ג ליעד` : '🎯 הגעת ליעד!'}
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#1e2020] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.4, ease: [0.34, 1.56, 0.64, 1], delay: 0.4 }}
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #c3f400 0%, #38bdf8 100%)' }}
          />
        </div>
        {alreadyLost > 0.05 && (
          <p className="text-xs text-[#c4c9ac] text-center">
            ירדת {alreadyLost.toFixed(1)} ק"ג מאז ההתחלה 💪
          </p>
        )}
      </motion.div>

      {/* History */}
      {weightLogs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl overflow-hidden" style={{ border: '1px solid #444933' }}
        >
          <div className="px-5 py-3 border-b border-[#444933]">
            <p className="text-xs font-semibold text-[#8e9379] uppercase tracking-widest">היסטוריה</p>
          </div>
          <div className="max-h-44 overflow-y-auto divide-y divide-[#444933]/40">
            {weightLogs.slice(0, 10).map((log, idx) => {
              const prev = weightLogs[idx + 1];
              const diff = prev ? log.weight_kg - prev.weight_kg : null;
              return (
                <div key={log.id} className="flex items-center px-5 py-3 gap-4">
                  <span className="text-xs text-[#8e9379] w-14 shrink-0">
                    {new Date(log.logged_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="flex-1 font-bold text-white">{log.weight_kg} ק"ג</span>
                  {diff !== null && (
                    <span className={`text-xs font-bold tabular-nums ${diff < 0 ? 'text-[#c3f400]' : 'text-red-400'}`}>
                      {diff < 0 ? '▼' : '▲'} {Math.abs(diff).toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {pct >= 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-2xl p-6 text-center border border-[#c3f400]/30"
        >
          <p className="text-3xl mb-2">🎉</p>
          <p className="font-bold text-lg text-[#c3f400]">הגעת למטרה!</p>
          <p className="text-sm text-[#c4c9ac] mt-1">מזל טוב על ההצלחה!</p>
        </motion.div>
      )}
    </div>
  );
}

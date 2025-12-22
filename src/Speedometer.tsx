import React, { useMemo } from "react";

interface SpeedometerProps {
  value: number;
  min?: number;
  max?: number;
}

const Speedometer: React.FC<SpeedometerProps> = ({
  value,
  min = 0,
  max = 120,
}) => {
  const startAngle = -120;
  const endAngle = 120;
  const centerX = 100;
  const centerY = 100;
  const radius = 80;
  const clampedValue = Math.min(Math.max(value, min), max);
  const displayValue = Math.round(clampedValue);

  // 指针角度
  const angle = startAngle + ((clampedValue - min) / (max - min)) * (endAngle - startAngle);

  // 刻度
  const ticks = useMemo(() => {
    const arr: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      value: number;
      angle: number;
      major: boolean;
    }[] = [];
    max = Math.max(max, min + 10);
    let step = 10;
    if (max <= 15) {
      step = 1;
    } else if (max <= 30) {
      step = 2;
    } else if (max <= 60) {
      step = 5;
    }

    for (let i = min; i <= max; i += step) {
      const tickAngle =
        startAngle + ((i - min) / (max - min)) * (endAngle - startAngle);
      const isMajor = i % (2 * step) === 0;
      const length = isMajor ? 12 : 6;
      const x1 = centerX + (radius - length) * Math.sin((tickAngle * Math.PI) / 180);
      const y1 = centerY - (radius - length) * Math.cos((tickAngle * Math.PI) / 180);
      const x2 = centerX + radius * Math.sin((tickAngle * Math.PI) / 180);
      const y2 = centerY - radius * Math.cos((tickAngle * Math.PI) / 180);
      arr.push({ x1, y1, x2, y2, value: i, angle: tickAngle, major: isMajor });
    }
    return arr;
  }, [min, max]);

  // 半圆路径
  const arcPath = (start: number, end: number, r: number) => {
    const x1 = centerX + r * Math.sin((start * Math.PI) / 180);
    const y1 = centerY - r * Math.cos((start * Math.PI) / 180);
    const x2 = centerX + r * Math.sin((end * Math.PI) / 180);
    const y2 = centerY - r * Math.cos((end * Math.PI) / 180);
    const largeArcFlag = end - start > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox="0 0 200 155"
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <defs>
          <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="green" />
            <stop offset="50%" stopColor="yellow" />
            <stop offset="100%" stopColor="red" />
          </linearGradient>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="2"
              floodColor="rgba(0,0,0,0.5)"
            />
          </filter>
        </defs>

        {/* 仪表背景 */}
        <circle cx={centerX} cy={centerY} r={radius + 15} fill="#222" />

        {/* 渐变弧 */}
        <path
          d={arcPath(startAngle, endAngle, radius)}
          stroke="url(#speedGradient)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
        />

        {/* 刻度线 */}
        {ticks.map((t, idx) => (
          <line
            key={idx}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="#fff"
            strokeWidth={t.major ? 2 : 1}
          />
        ))}

        {/* 刻度数字 */}
        {ticks
          .filter((t) => t.major)
          .map((t, idx) => (
            <text
              key={`label-${idx}`}
              x={centerX + (radius - 22) * Math.sin((t.angle * Math.PI) / 180)}
              y={centerY - (radius - 22) * Math.cos((t.angle * Math.PI) / 180) + 3}
              fontSize="10"
              fill="#fff"
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {t.value}
            </text>
          ))}

        {/* 指针 */}
        <g
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: "100px 100px",
            transition: "transform 0.6s ease-out",
          }}
        >
          <line x1={centerX} y1={centerY} x2={centerX} y2={centerY - radius + 20} stroke="red" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* 中心点 */}
        <circle cx={centerX} cy={centerY} r="6" fill="#fff" />
        {/* 当前数值 */}
        <text x={centerX} y={centerY + 45} fontSize="18" fill="#ffffff" textAnchor="middle" alignmentBaseline="middle" fontWeight="bold">
          {displayValue} km/h
        </text>
      </svg>
    </div>
  );
};

export default Speedometer;

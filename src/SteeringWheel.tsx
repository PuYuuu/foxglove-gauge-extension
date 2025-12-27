/*
 * @Author: puyu yu.pu@qq.com
 * @Date: 2025-12-23 00:21:43
 * @LastEditTime: 2025-12-26 23:52:44
 * @FilePath: \foxglove-gauge-extension\src\SteeringWheel.tsx
 */

import React from "react";

interface SteeringWheelProps {
  angle: number; // 当前方向盘转角（单位：度，正负表示左右）
  showAngle?: boolean; // 是否显示当前角度
}

const SteeringWheel: React.FC<SteeringWheelProps> = ({ angle, showAngle = false }) => {
  const originalAngle = angle; // 保存原始角度用于显示
  angle = Math.max(Math.min(angle, 450), -450); // 限制最大转角为 ±450 度
  angle = angle * -1.0; // 方向盘转动方向与角度符号相反
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
        position: "relative",
      }}
    >
      {/* 角度显示 */}
      {showAngle && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            fontSize: "24px",
            fontWeight: "bold",
            color: "#ffffff",
            textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
            zIndex: 10,
          }}
        >
          {originalAngle.toFixed(1)}°
        </div>
      )}
      <svg
        viewBox="0 0 400 400"
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: "100%",
          height: "100%",
          transform: `rotate(${angle}deg)` ,
        }}
      >
        {/* 渐变定义 */}
        <defs>
          <linearGradient id="rimGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#333" />
            <stop offset="100%" stopColor="#222" />
          </linearGradient>
          <radialGradient id="centerGradient">
            <stop offset="0%" stopColor="#666" />
            <stop offset="100%" stopColor="#222" />
          </radialGradient>
        </defs>
        {/* 将整个方向盘图形整体放大一点，让其占据更大画面 */}
        <g transform="translate(200 200) scale(1.2) translate(-200 -200)">
          {/* 外环（方向盘主体） */}
          <circle
            cx="200"
            cy="200"
            r="150"
            fill="none"
            stroke="url(#rimGradient)"
            strokeWidth="30"
          />

          {/* 上方横杆 */}
          <rect
            x="180"
            y="240"
            width="40"
            height="100"
            rx="10"
            fill="#222"
            stroke="#444"
            strokeWidth="2"
          />

          {/* 左侧横杆 */}
          <rect
            x="60"
            y="180"
            width="100"
            height="40"
            rx="10"
            fill="#222"
            stroke="#444"
            strokeWidth="2"
          />

          {/* 右侧横杆 */}
          <rect
            x="240"
            y="180"
            width="100"
            height="40"
            rx="10"
            fill="#222"
            stroke="#444"
            strokeWidth="2"
          />

          {/* 中心圆盘 */}
          <circle cx="200" cy="200" r="50" fill="url(#centerGradient)" />

          {/* 中心标志（装饰点） */}
          <circle cx="200" cy="200" r="10" fill="#999" />
        </g>
      </svg>
    </div>
  );
};

export default SteeringWheel;

/*
 * @Author: puyu yu.pu@qq.com
 * @Date: 2025-12-23 22:40:39
 * @LastEditTime: 2025-12-27 22:31:47
 * @FilePath: \foxglove-gauge-extension\src\TimeSeriesChart.tsx
 */

import React, { useState, useEffect, useRef } from "react";

interface DataPoint {
  timestamp: number; // 毫秒时间戳
  value: number;
}

interface TimeSeriesChartProps {
  value: number;
  timestamp: number; // 毫秒时间戳
  timeWindowSeconds?: number; // 时间窗口，单位秒
  lineColor?: string;
  lineWidth?: number; // 线条宽度
  backgroundColor?: string;
  gridColor?: string;
  showGrid?: boolean;
  min?: number;
  max?: number;
  autoScale?: boolean;
  colorScheme?: "light" | "dark";
  valueDisplayMode?: "dynamic" | "center"; // 当前值显示方式
  alpha?: number; // 低通滤波系数，0-1之间，0表示不滤波
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  value,
  timestamp,
  timeWindowSeconds = 10,
  lineColor,
  lineWidth = 2,
  backgroundColor,
  showGrid = true,
  colorScheme = "dark",
  valueDisplayMode = "dynamic",
  alpha = 0,
}) => {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastUpdateTime = useRef<number>(Date.now());

  // 根据主题设置默认颜色
  const isDark = colorScheme === "dark";
  const finalLineColor = lineColor ?? "#0066cc";
  const finalBackgroundColor = backgroundColor ?? (isDark ? "#1a1a1a" : "#ffffff");
  const finalGridColor = isDark ? "#333333" : "#e0e0e0";
  const textColor = isDark ? "#ffffff" : "#333333";
  const labelColor = isDark ? "#999999" : "#666666";
  const axisColor = isDark ? "#666666" : "#999999";

  // 更新数据点（基于时间窗口）
  useEffect(() => {
    // 忽略无效的时间戳（初始值0）
    if (timestamp === 0) {
      return;
    }

    setDataPoints((prev) => {
      // 检测是否需要清空数据（拖动进度条等场景）
      const shouldClear = prev.length > 0 && (() => {
        const lastPoint = prev[prev.length - 1]!;
        // 时间戳逆序
        if (timestamp < lastPoint.timestamp) {
          return true;
        }
        // 时间戳相差超过1秒
        if (timestamp - lastPoint.timestamp > 1000) {
          return true;
        }
        return false;
      })();

      const baseArray = shouldClear ? [] : prev;
      
      // 应用低通滤波
      let filteredValue = value;
      if (alpha > 0 && alpha <= 1) {
        const lastValue = baseArray.length > 0 ? baseArray[baseArray.length - 1]!.value : 0;
        filteredValue = lastValue * alpha + value * (1 - alpha);
      }
      
      // 添加新数据点
      const newPoint: DataPoint = { timestamp, value: filteredValue };
      const updated = [...baseArray, newPoint];

      // 移除超出时间窗口的数据点
      const windowMs = timeWindowSeconds * 1000;
      const cutoffTime = timestamp - windowMs;
      const filtered = updated.filter(p => p.timestamp >= cutoffTime);

      return filtered;
    });

    lastUpdateTime.current = timestamp;
  }, [value, timestamp, timeWindowSeconds, alpha]);

  // 绘制图表
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // 使用CSS尺寸进行绘制计算
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 10, right: 10, bottom: 10, left: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 清空画布
    ctx.fillStyle = finalBackgroundColor;
    ctx.fillRect(0, 0, width, height);

    // 计算时间范围
    const now = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1]!.timestamp : timestamp;
    const windowMs = timeWindowSeconds * 1000;
    const timeStart = now - windowMs;
    const timeEnd = now;

    // 计算数值范围
    let minVal: number = -10;
    let maxVal: number = 10;

    if (dataPoints.length > 0) {
      const values = dataPoints.map(p => p.value);
      minVal = Math.min(...values, 0); // 至少包含0
      maxVal = Math.max(...values, 0);
      const range = maxVal - minVal;
      if (range === 0) {
        minVal = minVal - 1;
        maxVal = maxVal + 1;
      } else {
        const margin = range * 0.1;
        minVal -= margin;
        maxVal += margin;
      }
    } 

    const valueRange = maxVal - minVal;

    // 绘制网格和刻度
    if (showGrid) {
      ctx.strokeStyle = finalGridColor;
      ctx.lineWidth = 1;
      ctx.font = "12px Arial";
      ctx.fillStyle = labelColor;

      // 水平网格线（Y轴 - 数值）
      const ySteps = 5;
      for (let i = 0; i <= ySteps; i++) {
        const y = padding.top + (chartHeight * i) / ySteps;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        // Y轴刻度标签
        const valueAtY = maxVal - (valueRange * i) / ySteps;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(valueAtY.toFixed(1), padding.left - 5, y);
      }

      // 垂直网格线（X轴 - 时间）
      const xSteps = 10;
      for (let i = 0; i <= xSteps; i++) {
        const x = padding.left + (chartWidth * i) / xSteps;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();

        // X轴时间刻度标签
        // const timeAtX = timeStart + (windowMs * i) / xSteps;
        // const secondsAgo = (now - timeAtX) / 1000;
        // ctx.textAlign = "center";
        // ctx.textBaseline = "top";
        // ctx.fillText(`-${secondsAgo.toFixed(1)}s`, x, padding.top + chartHeight + 5);
      }
    }

    // 绘制坐标轴
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    // 绘制曲线
    ctx.strokeStyle = finalLineColor;
    ctx.lineWidth = lineWidth;

    // 将时间转换为X坐标
    const timeToX = (timestamp: number) => {
      const timeFraction = (timestamp - timeStart) / windowMs;
      return padding.left + timeFraction * chartWidth;
    };

    // 将数值转换为Y坐标
    const valueToY = (val: number) => {
      const normalizedValue = (val - minVal) / valueRange;
      return padding.top + chartHeight * (1 - normalizedValue);
    };

    // 绘制数据点和连线
    if (dataPoints.length > 0) {
      ctx.beginPath();
      let isDrawing = false;

      // 绘制所有数据点
      dataPoints.forEach((point, index) => {
        const x = timeToX(point.timestamp);
        const y = valueToY(point.value);

        if (!isDrawing) {
          ctx.moveTo(x, y);
          isDrawing = true;
        } else {
          // 检查与前一个点的时间间隔
          if (index > 0) {
            const prevPoint = dataPoints[index - 1]!;
            const timeDiff = point.timestamp - prevPoint.timestamp;
            
            // 如果间隔超过200ms，认为是间隙，先下降到0再上升
            if (timeDiff > 200) {
              ctx.lineTo(timeToX(prevPoint.timestamp), valueToY(0));
              ctx.lineTo(timeToX(point.timestamp), valueToY(0));
            }
          }
          ctx.lineTo(x, y);
        }
      });

      // 从最后一个点连到当前时间（如果有延迟，显示为0）
      const lastPoint = dataPoints[dataPoints.length - 1]!;
      if (now - lastPoint.timestamp > 100) {
        ctx.lineTo(timeToX(lastPoint.timestamp), valueToY(0));
        ctx.lineTo(timeToX(now), valueToY(0));
      } else {
        ctx.lineTo(timeToX(now), valueToY(lastPoint.value));
      }

      ctx.stroke();

      // 绘制当前值标记点和数值
      if (now - lastPoint.timestamp <= 100) {
        const lastX = timeToX(now);
        const lastY = valueToY(lastPoint.value);

        // 绘制标记点
        ctx.fillStyle = finalLineColor;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fill();

        if (valueDisplayMode === "center") {
          ctx.fillStyle = textColor;
          ctx.globalAlpha = 0.6;
          ctx.font = "bold 96px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${lastPoint.value.toFixed(2)}`, width / 2, height / 2);
          ctx.globalAlpha = 1.0;
        } else {
          ctx.fillStyle = textColor;
          ctx.globalAlpha = 0.8;
          ctx.font = "bold 18px Arial";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          const displayX = lastX + 8 > width - padding.right ? lastX - 8 : lastX + 8;
          ctx.textAlign = lastX + 8 > width - padding.right ? "right" : "left";
          ctx.fillText(`${lastPoint.value.toFixed(2)}`, displayX, lastY);
        }
      }
    } else {
      // 没有数据时，绘制0线
      ctx.beginPath();
      ctx.moveTo(padding.left, valueToY(0));
      ctx.lineTo(padding.left + chartWidth, valueToY(0));
      ctx.stroke();
    }

    // 绘制标题
    // ctx.fillStyle = textColor;
    // ctx.font = "14px Arial";
    // ctx.textAlign = "center";
    // ctx.textBaseline = "top";
    // ctx.fillText(
    //   `Time Window: ${timeWindowSeconds}s (${dataPoints.length} samples)`,
    //   width / 2,
    //   5
    // );
    // console.log(`Time Window: ${timeWindowSeconds}s (${dataPoints.length} samples)`);
  }, [
    dataPoints,
    timeWindowSeconds,
    finalLineColor,
    lineWidth,
    finalBackgroundColor,
    finalGridColor,
    textColor,
    labelColor,
    axisColor,
    showGrid,
    canvasSize,
    valueDisplayMode,
  ]);
  // 响应式调整canvas大小（支持高DPI显示）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        
        // 设置canvas的实际像素大小（考虑DPI）
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        // 缩放绘图上下文以匹配DPI
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(dpr, dpr);
        }

        // CSS大小保持不变
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        // 触发重绘
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    
    // 使用ResizeObserver监听容器大小变化
    const resizeObserver = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        position: "relative",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
};

export default TimeSeriesChart;

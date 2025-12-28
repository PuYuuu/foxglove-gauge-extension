/*
 * @Author: puyu yu.pu@qq.com
 * @Date: 2025-12-22 23:19:47
 * @LastEditTime: 2025-12-28 21:48:03
 * @FilePath: \foxglove-gauge-extension\src\panel.tsx
 */

import {
  Immutable,
  MessageEvent,
  PanelExtensionContext,
  Topic,
  SettingsTreeAction,
} from "@foxglove/extension";
import { ReactElement, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import Speedometer from "./Speedometer";
import SteeringWheel from "./SteeringWheel";
import TimeSeriesChart from "./TimeSeriesChart";

type PanelState = {
  data: {
    messagePath?: string;
    min: number;
    max: number;
    timeWindow?: number;   // 时间窗口，单位秒
    showGrid?: boolean;
    valueDisplayMode?: "dynamic" | "center";
    showAngle?: boolean;  // 方向盘是否显示角度
    lineColor?: string;   // 时序图线条颜色
    lineWidth?: number;   // 时序图线条宽度
    alpha?: number;       // 低通滤波系数
  };
  view: {
    component: "speedometer" | "steeringWheel" | "timeSeriesChart";
  };
};

// Math modifier parser and applier
type MathModifier = {
  type: "simple" | "parameterized";
  name:
    | "abs"
    | "acos"
    | "asin"
    | "atan"
    | "ceil"
    | "cos"
    | "log"
    | "log1p"
    | "log2"
    | "log10"
    | "negative"
    | "round"
    | "sign"
    | "sin"
    | "sqrt"
    | "tan"
    | "trunc"
    | "delta"
    | "derivative"
    | "add"
    | "sub"
    | "mul"
    | "div";
  operand?: number;
};

function parseMathModifiers(path: string): { fieldPath: string; modifiers: MathModifier[] } {
  const modifiers: MathModifier[] = [];
  let currentPath = path;

  // 匹配所有 .@modifier 或 .@modifier(operand) 的模式
  const modifierRegex = /\.@(\w+)(?:\(([^)]+)\))?/g;
  let match;

  while ((match = modifierRegex.exec(path)) !== null) {
    const modifierName = match[1];
    const operand = match[2];

    // 检查是否是有效的修饰符
    const simpleModifiers = [
      "abs",
      "acos",
      "asin",
      "atan",
      "ceil",
      "cos",
      "log",
      "log1p",
      "log2",
      "log10",
      "negative",
      "round",
      "sign",
      "sin",
      "sqrt",
      "tan",
      "trunc",
      "delta",
      "derivative",
    ];
    const parameterizedModifiers = ["add", "sub", "mul", "div"];

    if (modifierName && simpleModifiers.includes(modifierName)) {
      modifiers.push({
        type: "simple",
        name: modifierName as any,
      });
    } else if (modifierName && parameterizedModifiers.includes(modifierName) && operand !== undefined) {
      const numOperand = Number(operand);
      if (!Number.isNaN(numOperand)) {
        modifiers.push({
          type: "parameterized",
          name: modifierName as any,
          operand: numOperand,
        });
      }
    }
  }

  // 移除所有修饰符后缀，得到纯字段路径
  const cleanPath = path.replace(modifierRegex, "");

  return { fieldPath: cleanPath, modifiers };
}

function applyMathModifiers(
  value: number,
  modifiers: MathModifier[],
  previousValue?: { value: number; timestamp: number },
  currentTimestamp?: number,
): number {
  let result = value;

  for (const modifier of modifiers) {
    switch (modifier.name) {
      case "abs":
        result = Math.abs(result);
        break;
      case "acos":
        result = Math.acos(result);
        break;
      case "asin":
        result = Math.asin(result);
        break;
      case "atan":
        result = Math.atan(result);
        break;
      case "ceil":
        result = Math.ceil(result);
        break;
      case "cos":
        result = Math.cos(result);
        break;
      case "log":
        result = Math.log(result);
        break;
      case "log1p":
        result = Math.log1p(result);
        break;
      case "log2":
        result = Math.log2(result);
        break;
      case "log10":
        result = Math.log10(result);
        break;
      case "negative":
        result = -result;
        break;
      case "round":
        result = Math.round(result);
        break;
      case "sign":
        result = Math.sign(result);
        break;
      case "sin":
        result = Math.sin(result);
        break;
      case "sqrt":
        result = Math.sqrt(result);
        break;
      case "tan":
        result = Math.tan(result);
        break;
      case "trunc":
        result = Math.trunc(result);
        break;
      case "add":
        result = result + (modifier.operand ?? 0);
        break;
      case "sub":
        result = result - (modifier.operand ?? 0);
        break;
      case "mul":
        result = result * (modifier.operand ?? 1);
        break;
      case "div":
        if (modifier.operand && modifier.operand !== 0) {
          result = result / modifier.operand;
        }
        break;
      case "delta":
        if (previousValue !== undefined) {
          result = result - previousValue.value;
        }
        break;
      case "derivative":
        if (previousValue !== undefined && currentTimestamp !== undefined) {
          const timeDiff = (currentTimestamp - previousValue.timestamp) / 1000; // 转换为秒
          if (timeDiff > 0) {
            result = (result - previousValue.value) / timeDiff;
          }
        }
        break;
    }
  }

  return result;
}

function getFieldValue(
  message: unknown,
  path: string | undefined,
  previousValue?: { value: number; timestamp: number },
  currentTimestamp?: number,
): unknown {
  if (!message || !path) {
    return undefined;
  }

  const { fieldPath, modifiers } = parseMathModifiers(path);
  const segments = fieldPath.split(".").filter((segment) => segment.length > 0);
  let current: unknown = message as Record<string, unknown>;

  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }

    const obj = current as Record<string, unknown>;
    current = obj[segment];
  }

  // 应用 math modifiers
  if (typeof current === "number" && modifiers.length > 0) {
    current = applyMathModifiers(current, modifiers, previousValue, currentTimestamp);
  }

  return current;
}

function parseMessagePath(messagePath: string | undefined): {
  topic?: string;
  fieldPath?: string;
} {
  if (!messagePath) {
    return {};
  }

  const trimmed = messagePath.trim();
  if (!trimmed) {
    return {};
  }

  const dotIndex = trimmed.indexOf(".");
  if (dotIndex === -1) {
    return { topic: trimmed };
  }

  return {
    topic: trimmed.slice(0, dotIndex),
    fieldPath: trimmed.slice(dotIndex + 1),
  };
}

function GaugePanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [topics, setTopics] = useState<undefined | Immutable<Topic[]>>();
  const [messages, setMessages] = useState<undefined | Immutable<MessageEvent[]>>();
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("dark");

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  const [messageValue, setmessageValue] = useState(0);
  const [messageTimestamp, setMessageTimestamp] = useState(0);
  const [previousMessageValue, setPreviousMessageValue] = useState<{
    value: number;
    timestamp: number;
  } | undefined>();

  const [state, setState] = useState<PanelState>(() => {
    const initial = context.initialState as Partial<PanelState> | undefined;

    const legacyData = (context.initialState as any)?.data as
      | { topic?: string; fieldPath?: string; min?: number; max?: number }
      | undefined;
    const legacyTopic = legacyData?.topic;
    const legacyFieldPath = legacyData?.fieldPath;
    const legacyMessagePath =
      legacyTopic && legacyTopic.length > 0
        ? `${legacyTopic}${legacyFieldPath ? `.${legacyFieldPath}` : ""}`
        : undefined;

    return {
      data: {
        messagePath: initial?.data?.messagePath ?? legacyMessagePath ?? "",
        min: initial?.data?.min ?? 0,
        max: initial?.data?.max ?? 120,
      },
      view: {
        component: initial?.view?.component ?? "speedometer",
      },
    };
  });

  // 处理来自设置面板的更新
  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      const { path, value } = action.payload;
      const group = path[0];
      const field = path[1];

      setState((prev) => {
        const next: PanelState = {
          data: { ...prev.data },
          view: { ...prev.view },
        };

        if (group === "data") {
          if (field === "messagePath") {
            next.data.messagePath = value as string;
          } else if (field === "min") {
            const num = Number(value);
            if (!Number.isNaN(num)) {
              next.data.min = num;
            }
          } else if (field === "max") {
            const num = Number(value);
            if (!Number.isNaN(num)) {
              next.data.max = num;
            }
          } else if (field === "timeWindow") {
            const num = Number(value);
            if (!Number.isNaN(num) && num > 0) {
              next.data.timeWindow = num;
            }
          } else if (field === "showGrid") {
            next.data.showGrid = value as boolean;
          } else if (field === "valueDisplayMode") {
            next.data.valueDisplayMode = value as "dynamic" | "center";
          } else if (field === "showAngle") {
            next.data.showAngle = value as boolean;
          } else if (field === "lineColor") {
            next.data.lineColor = value as string;
          } else if (field === "lineWidth") {
            const num = Number(value);
            if (!Number.isNaN(num) && num > 0) {
              next.data.lineWidth = num;
            }
          } else if (field === "alpha") {
            const num = Number(value);
            if (!Number.isNaN(num) && num >= 0 && num <= 1) {
              next.data.alpha = num;
            }
          }
        } else if (group === "view") {
          if (field === "component") {
            next.view.component = value as PanelState["view"]["component"];
          }
        }

        return next;
      });
    },
    [context],
  );

  // 每次状态或可用 topic 变更时，同步设置编辑器 & 持久化状态
  useEffect(() => {
    context.saveState(state);

    const topicOptions = (topics ?? []).map((topic) => ({
      value: topic.name,
      label: topic.name,
    }));

    // 根据当前组件类型动态生成数据设置字段
    const dataFields: Record<string, any> = {
      messagePath: {
        label: "Message path",
        input: "messagepath",
        value: state.data.messagePath ?? "",
        validTypes: ["float32", "float64", "int8", "uint8", "int16", "uint16", "int32", "uint32"],
        validTopics: topicOptions.map((opt) => opt.value ?? ""),
        supportsMathModifiers: true,
      },
    };

    // 根据组件类型添加特定的设置项
    if (state.view.component === "speedometer") {
      dataFields.min = {
        label: "Min Value",
        input: "number",
        value: state.data.min,
      };
      dataFields.max = {
        label: "Max Value",
        input: "number",
        value: state.data.max,
      };
    } else if (state.view.component === "timeSeriesChart") {
      dataFields.timeWindow = {
        label: "Time Window (seconds)",
        input: "number",
        value: state.data.timeWindow,
        min: 1,
        max: 300,
        step: 1,
      };
      dataFields.showGrid = {
        label: "Show Grid",
        input: "boolean",
        value: state.data.showGrid ?? true,
      };
      dataFields.valueDisplayMode = {
        label: "Value Display",
        input: "select",
        value: state.data.valueDisplayMode ?? "dynamic",
        options: [
          { value: "dynamic", label: "Follow" },
          { value: "center", label: "Center" },
        ],
      };
      dataFields.lineColor = {
        label: "Line Color",
        input: "rgb",
        value: state.data.lineColor ?? "#0066cc",
      };
      dataFields.lineWidth = {
        label: "Line Width",
        input: "number",
        value: state.data.lineWidth ?? 2,
        min: 1,
        max: 10,
        step: 0.5,
      };
      dataFields.alpha = {
        label: "Filter Alpha",
        input: "number",
        value: state.data.alpha ?? 0,
        min: 0,
        max: 1,
        step: 0.01,
      };
    } else if (state.view.component === "steeringWheel") {
      dataFields.showAngle = {
        label: "Show Angle",
        input: "boolean",
        value: state.data.showAngle ?? false,
      };
    }

    context.updatePanelSettingsEditor({
      actionHandler,
      nodes: {
        view: {
          label: "Display",
          icon: "World",
          fields: {
            component: {
              label: "Component",
              input: "select",
              value: state.view.component,
              options: [
                { value: "speedometer", label: "Speedometer" },
                { value: "steeringWheel", label: "Steering Wheel" },
                { value: "timeSeriesChart", label: "Time Series Chart" },
              ],
            },
          },
        },
        data: {
          label: "Data",
          icon: "Settings",
          fields: dataFields,
        },
      },
    });
  }, [actionHandler, context, state, topics]);

  useLayoutEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);

      setTopics(renderState.topics);

      setMessages(renderState.currentFrame);
      
      if (renderState.colorScheme) {
        setColorScheme(renderState.colorScheme);
      }
    };

    context.watch("topics");
    context.watch("colorScheme");

    context.watch("currentFrame");
    const { topic } = parseMessagePath(state.data.messagePath);
    if (topic) {
      context.subscribe([{ topic }]);
    }
  }, [context, state.data.messagePath]);

  // invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  // topic 或字段路径变更时重置为 0，避免沿用旧 topic 的值
  useEffect(() => {
    setmessageValue(0);
  }, [state.data.messagePath]);

  // 从当前帧中选取所选 topic 的最新消息，并按字段路径取值，只在有新值时更新
  useEffect(() => {
    if (!messages || !state.data.messagePath) {
      return;
    }

    const { topic, fieldPath } = parseMessagePath(state.data.messagePath);
    if (!topic || !fieldPath) {
      return;
    }

    const eventsForTopic = messages.filter((event) => event.topic === topic);
    const lastEvent = eventsForTopic[eventsForTopic.length - 1];

    if (!lastEvent) {
      return;
    }

    // 提取消息时间戳（使用receiveTime）
    const receiveTime = lastEvent.receiveTime;
    const currentTimestampMs = receiveTime.sec * 1000 + receiveTime.nsec / 1000000;
    setMessageTimestamp(currentTimestampMs);

    const message = (lastEvent as MessageEvent).message;
    // 使用 fieldPath（包含修饰符）来获取值，不包括 topic 名称
    const rawValue = getFieldValue(message, fieldPath, previousMessageValue, currentTimestampMs);

    let nextValue: number | undefined;
    if (typeof rawValue === "number") {
      nextValue = rawValue;
    } else if (typeof rawValue === "string") {
      const parsed = Number(rawValue);
      if (!Number.isNaN(parsed)) {
        nextValue = parsed;
      }
    }

    if (typeof nextValue === "number" && !Number.isNaN(nextValue)) {
      // 保存当前值作为下次的前一个值（使用当前状态中的值）
      setmessageValue((prevValue) => {
        setPreviousMessageValue({ value: prevValue, timestamp: messageTimestamp });
        return nextValue;
      });
    }
  }, [messages, state.data.messagePath, previousMessageValue]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "transparent",
        padding: state.view.component === "timeSeriesChart" ? 0 : 8,
        boxSizing: "border-box",
      }}
    >
      {state.view.component === "speedometer" ? (
        <Speedometer value={messageValue} min={state.data.min} max={state.data.max} />
      ) : state.view.component === "steeringWheel" ? (
        <SteeringWheel angle={messageValue} showAngle={state.data.showAngle} />
      ) : (
        <TimeSeriesChart 
          value={messageValue}
          timestamp={messageTimestamp}
          colorScheme={colorScheme}
          showGrid={state.data.showGrid}
          valueDisplayMode={state.data.valueDisplayMode}
          timeWindowSeconds={state.data.timeWindow}
          lineColor={state.data.lineColor}
          lineWidth={state.data.lineWidth}
          alpha={state.data.alpha}
        />
      )}
    </div>
  );
}

export function initGaugePanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<GaugePanel context={context} />);

  return () => {
    root.unmount();
  };
}

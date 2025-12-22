/*
 * @Author: puyu yu.pu@qq.com
 * @Date: 2025-12-22 23:19:47
 * @LastEditors: puyu yu.pu@qq.com
 * @LastEditTime: 2025-12-23 00:32:24
 * @FilePath: \gauge_utils\src\panel.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
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

type PanelState = {
  data: {
    messagePath?: string;
    min: number;
    max: number;
  };
  view: {
    component: "speedometer" | "steeringWheel";
  };
};

function getFieldValue(message: unknown, path: string | undefined): unknown {
  if (!message || !path) {
    return undefined;
  }

  const segments = path.split(".").filter((segment) => segment.length > 0);
  let current: unknown = message as Record<string, unknown>;

  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }

    const obj = current as Record<string, unknown>;
    current = obj[segment];
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

function ExamplePanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [topics, setTopics] = useState<undefined | Immutable<Topic[]>>();
  const [messages, setMessages] = useState<undefined | Immutable<MessageEvent[]>>();

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  const [speedValue, setSpeedValue] = useState(0);

  const [state, setState] = useState<PanelState>(() => {
    const initial = context.initialState as Partial<PanelState> | undefined;

    // 兼容旧版本单独保存 topic 和 fieldPath 的状态
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
            const { topic } = parseMessagePath(next.data.messagePath);
            if (topic) {
              context.subscribe([{ topic }]);
            }
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
              ],
            },
          },
        },
        data: {
          label: "Data",
          icon: "Settings",
          fields: {
            messagePath: {
              label: "Message path",
              input: "messagepath",
              value: state.data.messagePath ?? "",
              validTypes: ["float32", "float64", "int8", "uint8", "int16", "uint16", "int32", "uint32"],
              validTopics: topicOptions.map((opt) => opt.value ?? ""),
              supportsMathModifiers: true,
            },
            min: {
              label: "Min Value",
              input: "number",
              value: state.data.min,
            },
            max: {
              label: "Max Value",
              input: "number",
              value: state.data.max,
            },
          },
        },
      },
    });
  }, [actionHandler, context, state, topics]);

  useLayoutEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);

      setTopics(renderState.topics);

      setMessages(renderState.currentFrame);
    };

    context.watch("topics");

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
    setSpeedValue(0);
  }, [state.data.messagePath]);

  // 从当前帧中选取所选 topic 的最新消息，并按字段路径取值，只在有新值时更新
  useEffect(() => {
    if (!messages || !state.data.messagePath) {
      return;
    }

    const { topic, fieldPath } = parseMessagePath(state.data.messagePath);
    if (!topic) {
      return;
    }

    const eventsForTopic = messages.filter((event) => event.topic === topic);
    const lastEvent = eventsForTopic[eventsForTopic.length - 1];

    if (!lastEvent) {
      return;
    }

    const message = (lastEvent as MessageEvent).message;
    const rawValue = fieldPath ? getFieldValue(message, fieldPath) : (message as unknown);

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
      setSpeedValue(nextValue);
    }
  }, [messages, state.data.messagePath]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "transparent",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      {state.view.component === "speedometer" ? (
        <Speedometer value={speedValue * 3.6} min={state.data.min} max={state.data.max} />
      ) : (
        <SteeringWheel angle={speedValue * 15.6 * 57.29578} />
      )}
    </div>
  );
}

export function initExamplePanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<ExamplePanel context={context} />);

  return () => {
    root.unmount();
  };
}

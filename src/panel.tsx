/*
 * @Author: puyu yu.pu@qq.com
 * @Date: 2025-12-22 23:19:47
 * @LastEditors: puyu yu.pu@qq.com
 * @LastEditTime: 2025-12-23 00:03:45
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

type PanelState = {
  data: {
    topic?: string;
    fieldPath?: string;
    min: number;
    max: number;
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

function ExamplePanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [topics, setTopics] = useState<undefined | Immutable<Topic[]>>();
  const [messages, setMessages] = useState<undefined | Immutable<MessageEvent[]>>();

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  const [speedValue, setSpeedValue] = useState(0);

  const [state, setState] = useState<PanelState>(() => {
    const initial = context.initialState as Partial<PanelState> | undefined;
    return {
      data: {
        topic: initial?.data?.topic ?? "/some/topic",
        fieldPath: initial?.data?.fieldPath ?? "",
        min: initial?.data?.min ?? 0,
        max: initial?.data?.max ?? 120,
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
      if (path[0] !== "data") {
        return;
      }

      const field = path[1];

      setState((prev) => {
        const next: PanelState = {
          data: { ...prev.data },
        };

        if (field === "topic") {
          next.data.topic = value as string;
          if (next.data.topic) {
            context.subscribe([{ topic: next.data.topic }]);
          }
        } else if (field === "fieldPath") {
          next.data.fieldPath = value as string;
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
        data: {
          label: "Speedometer Settings",
          icon: "Settings",
          fields: {
            topic: {
              label: "Topic",
              input: "select",
              options: topicOptions,
              value: state.data.topic,
            },
            fieldPath: {
              label: "Field path (e.g. data.speed)",
              input: "string",
              value: state.data.fieldPath ?? "",
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
    if (state.data.topic) {
      context.subscribe([{ topic: state.data.topic }]);
    }
  }, [context, state.data.topic]);

  // invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  // topic 或字段路径变更时重置为 0，避免沿用旧 topic 的值
  useEffect(() => {
    setSpeedValue(0);
  }, [state.data.topic, state.data.fieldPath]);

  // 从当前帧中选取所选 topic 的最新消息，并按字段路径取值，只在有新值时更新
  useEffect(() => {
    if (!messages || !state.data.topic || !state.data.fieldPath) {
      return;
    }

    const eventsForTopic = messages.filter((event) => event.topic === state.data.topic);
    const lastEvent = eventsForTopic[eventsForTopic.length - 1];

    if (!lastEvent) {
      return;
    }

    const rawValue = getFieldValue((lastEvent as MessageEvent).message, state.data.fieldPath);

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
  }, [messages, state.data.topic, state.data.fieldPath]);

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
      <Speedometer value={speedValue * 3.6} min={state.data.min} max={state.data.max} />
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

/*
 * @Author: puyu yu.pu@qq.com
 * @Date: 2025-12-22 23:19:47
 * @LastEditTime: 2025-12-26 23:53:59
 * @FilePath: \foxglove-gauge-extension\src\index.ts
 */

import { ExtensionContext } from "@foxglove/extension";

import { initGaugePanel } from "./panel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({ name: "gauge_utils", initPanel: initGaugePanel });
}

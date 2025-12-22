/*
 * @Author: puyu yu.pu@qq.com
 * @Date: 2025-12-22 23:19:47
 * @LastEditors: puyu yu.pu@qq.com
 * @LastEditTime: 2025-12-22 23:28:02
 * @FilePath: \gauge_utils\src\index.ts
 */
import { ExtensionContext } from "@foxglove/extension";

import { initExamplePanel } from "./panel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({ name: "gauge_utils", initPanel: initExamplePanel });
}

# Multi Funscript Editor 产品功能规划

## 1. 产品定位

Multi Funscript Editor 是一个基于 Web 的视频脚本编辑器，用于根据视频创建、编辑和导出兼容主流播放器的 `.funscript` 文件，同时支持自定义 `multiAction` 多动作设备指令。

目标文件结构：

```json
{
  "version": "1.0",
  "inverted": false,
  "range": 100,
  "actions": [
    { "at": 0, "pos": 0 }
  ],
  "metadata": {},
  "multiAction": {
    "version": "2.0",
    "timeline": [
      {
        "at": 0,
        "commands": [
          { "action": "empty", "qty": "0" }
        ]
      }
    ]
  }
}
```

## 2. 样例文件分析

样例文件：`10min-sample.funscript`

- 视频/脚本时长约 `599800ms`，约 10 分钟。
- 顶层标准 `actions` 数量：49 个。
- `multiAction.timeline` 数量：49 个。
- 顶层 `actions` 与 `multiAction.timeline` 当前基本一一对应。
- 已使用的自定义动作：
  - `SS`：伸缩，41 次。
  - `ZD`：震动，22 次。
  - `JX`：夹吸，11 次。
  - `XZ`：旋转，4 次。
  - `DT`：点头，1 次。
  - `empty`：空指令/停止，8 次。
- 样例暂未使用：
  - `JR`：加热。
  - `PS`：喷水。
  - `YL`：音量。

这个样例说明产品需要同时支持两种编辑视角：

1. 标准 funscript 视角：编辑 `actions[].at` 和 `actions[].pos`。
2. 多动作设备视角：编辑 `multiAction.timeline[].commands[]`。

## 3. 核心用户流程

### 3.1 新建脚本

用户上传或选择一个视频文件，系统创建空白脚本：

- 初始化 `version = "1.0"`。
- 初始化 `inverted = false`。
- 初始化 `range = 100`。
- 初始化 `actions = []`。
- 初始化 `multiAction.version = "2.0"`。
- 初始化 `multiAction.timeline = []`。

### 3.2 打开已有脚本

用户同时打开视频和 `.funscript` 文件：

- 如果存在 `actions`，进入标准 funscript 编辑模式。
- 如果存在 `multiAction.timeline`，进入多动作编辑模式。
- 如果只存在 `actions`，允许一键生成 `multiAction`。
- 如果只存在 `multiAction`，允许一键生成标准 `actions` fallback。
- 保存时必须保留未知字段，避免破坏其他工具生成的 metadata 或扩展信息。

### 3.3 编辑并导出

用户编辑完成后可以：

- 导出完整兼容文件：包含 `actions` + `multiAction`。
- 仅导出标准 `.funscript`：只保留主流播放器需要的字段。
- 仅导出设备协议时间线：用于调试或下发。

## 4. 页面与模块

### 4.1 顶部工具栏

功能：

- 打开视频。
- 打开 `.funscript`。
- 保存/导出。
- 撤销/重做。
- 播放/暂停。
- 当前时间显示。
- 缩放时间轴。
- 切换编辑模式：
  - 标准 actions。
  - multiAction。
  - 双轨同步。

### 4.2 视频预览区

功能：

- 播放本地视频。
- 拖动进度条。
- 快进/快退。
- 帧级或小步进跳转。
- 播放时同步时间轴游标。
- 支持设置播放速度。

### 4.3 标准 actions 时间轴

功能：

- 显示 `pos` 曲线，范围 `0-100`。
- 添加动作点。
- 删除动作点。
- 拖动动作点改变 `at` 和 `pos`。
- 批量选择动作点。
- 平滑/简化动作点。
- 自动排序。
- 校验重复时间点。
- 支持从 `multiAction.SS` 回写：
  - `pos = qty * 10`。

### 4.4 multiAction 多动作时间轴

默认支持 8 个动作轨道：

- `ZD` 震动。
- `JX` 夹吸。
- `SS` 伸缩。
- `XZ` 旋转。
- `JR` 加热。
- `DT` 点头。
- `PS` 喷水。
- `YL` 音量。

每个轨道功能：

- `qty` 范围 `0-10`。
- 支持在时间点添加/修改/删除动作。
- 支持同一时间点多个动作并发。
- 支持快速复制上一时间点指令。
- 支持设置为空指令：
  - `{ "action": "empty", "qty": "0" }`
- 支持关闭某个动作：
  - `{ "action": "SS", "qty": "0" }`

### 4.5 时间点详情面板

用户选中某个时间点后，右侧显示：

- `at` 毫秒。
- 标准 `pos`。
- multiAction commands 列表。
- 每个动作的 `qty`。
- 添加动作按钮。
- 删除动作按钮。
- 当前时间点 JSON 预览。

### 4.6 脚本校验面板

校验规则：

- `actions` 是否按 `at` 升序。
- `multiAction.timeline` 是否按 `at` 升序。
- `at` 是否为非负整数。
- `pos` 是否在 `0-100`。
- `qty` 是否在 `0-10`。
- `qty` 是否为字符串。
- 是否存在重复时间点。
- 是否存在未知动作。
- `actions` 和 `multiAction.timeline` 时长是否一致。

## 5. 关键转换规则

### 5.1 actions 生成 multiAction

默认把标准 `actions` 转成 `SS`：

```text
qty = round(pos / 10)
```

示例：

```json
{ "at": 5000, "pos": 60 }
```

转换为：

```json
{
  "at": 5000,
  "commands": [
    { "action": "SS", "qty": "6" }
  ]
}
```

### 5.2 multiAction 生成 actions

默认优先读取 `SS`：

```text
pos = qty * 10
```

如果当前时间点没有 `SS`：

- 方案 A：跳过该时间点。
- 方案 B：沿用上一 `SS` 值。
- 方案 C：使用最高优先级动作映射。

MVP 建议使用方案 A，避免生成误导性的标准动作。

### 5.3 多动作合并

同一个 `at` 下，多个动作合并到同一个 commands 数组：

```json
{
  "at": 11000,
  "commands": [
    { "action": "SS", "qty": "8" },
    { "action": "ZD", "qty": "8" },
    { "action": "JX", "qty": "7" },
    { "action": "XZ", "qty": "6" }
  ]
}
```

## 6. MVP 范围

第一版只做最关键闭环：

1. Web 页面加载本地视频。
2. 加载 `.funscript`。
3. 解析并显示标准 `actions`。
4. 解析并显示 `multiAction.timeline`。
5. 支持编辑动作点时间和值。
6. 支持编辑 `SS/ZD/JX/XZ/JR/DT/PS/YL` 的 `qty`。
7. 支持新增/删除时间点。
8. 支持导出完整 `.funscript`。
9. 支持 Docker 静态部署。
10. 支持撤销/重做与未保存状态提示。
11. 支持参考 funscript.cz 的快速打点面板，通过鼠标/触屏/键盘在视频播放时录制动作点。

## 7. V1 增强功能

- 波形或节奏辅助。
- 批量平滑。
- 批量缩放强度。
- 批量时间偏移。
- 多选复制/粘贴。
- 区间循环播放。
- 从标准 `actions` 自动生成 `multiAction`。
- 从 `multiAction` 自动生成标准 fallback。
- JSON diff 预览。
- 快捷键系统。
- 项目文件保存。

## 8. V2 智能生成功能

- 基于视频运动检测生成 `actions`。
- 基于音频节奏生成动作候选点。
- 基于已有标准 `actions` 自动补充 `ZD/JX/XZ` 等动作。
- 自动识别强度段落。
- 生成后提供人工审核队列。

## 9. 推荐技术方案

### 9.1 前端

- React + TypeScript。
- Vite。
- Zustand 或 Redux Toolkit 管理状态。
- HTML5 video 播放视频。
- Canvas 或 SVG 绘制时间轴。
- File System Access API 用于本地打开/保存，另提供普通下载 fallback。

### 9.2 数据层

核心类型：

```ts
type FunscriptAction = {
  at: number;
  pos: number;
};

type MultiActionCommand = {
  action: "ZD" | "JX" | "SS" | "XZ" | "JR" | "DT" | "PS" | "YL" | "empty";
  qty: string;
};

type MultiActionPoint = {
  at: number;
  commands: MultiActionCommand[];
};
```

### 9.3 Docker

MVP 可以只用静态部署：

```text
Vite build -> Nginx container
```

如果未来需要多人项目、云端保存、设备联调，再增加后端服务。

## 10. 二次开发建议

当前没有完全匹配需求的开源 Web 编辑器。建议：

- 参考 `funscript-utils` 的数据结构和 funscript 工具函数。
- 参考 `funscript-io` 的 Web 项目组织方式。
- 参考 OFS 的时间轴编辑体验和快捷键设计。
- 不建议直接把 OFS 改成 Web 项目。

更稳的路线是新建 Web 项目，同时吸收这些项目的设计。

## 11. 验收标准

MVP 完成后，应满足：

- 能打开 `10min-sample.funscript`。
- 能正确识别 49 个标准 `actions`。
- 能正确识别 49 个 `multiAction.timeline` 点。
- 能显示已使用动作：`SS/ZD/JX/XZ/DT/empty`。
- 能新增 `JR/PS/YL` 动作。
- 能导出后再次打开且内容不丢失。
- 导出的文件仍能被普通 funscript 工具读取标准 `actions`。
- Docker 部署后浏览器可直接使用。

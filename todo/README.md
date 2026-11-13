# Alan's Desk · 个人待办中心

**网页：** https://alan-william.github.io/todo/

位于现有 GitHub Pages 仓库的 `todo/` 子目录，原本根目录的刷题页面保持不变。

## 怎么使用

可以直接在 ChatGPT 中说：

- 添加待办：周五前完成电机实验报告，分类课程，优先级高。
- 把「整理实验报告」标记完成。
- 把任务 ID `task-20261113-001` 的截止日期改成 2026-11-30。
- 列出未完成的科研任务。

ChatGPT 使用已连接的 GitHub 操作，先读取本目录中的 `tasks.json`，按 ID 修改相应任务，再提交更改。网页会从公开 JSON 文件拉取数据，不需要安装服务端或数据库。页面上的完成按钮仅复制 ChatGPT 指令，并**不会直接修改 GitHub**。

## 数据规范

文件 `tasks.json` 为 JSON 对象，顶层字段 `schemaVersion` 固定为 1、`updatedAt` 为 ISO 8601 时间，`tasks` 为对象数组。每一项任务字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 唯一稳定 ID，例如 `task-20261113-001` |
| `title` | 任务标题 |
| `description` | 可选描述 |
| `category` | 科研、课程、项目、竞赛、个人、其他 |
| `priority` | `high`、`medium`、`low` |
| `status` | `todo`、`doing`、`done`、可选 `cancelled` |
| `due` | 本地日历日期 `YYYY-MM-DD`，未指定填 `null` |
| `createdAt` / `updatedAt` | ISO 8601 时间 |
| `tags` | 可选字符串数组 |
| `checklist` | 可选子项数组，每项含 `title` 和 `done` 布尔值 |
| `link` | 可选的 HTTP(S) 相关链接 |

**更新要求：** 每次先获取最新 `tasks.json` 与文件 SHA，保留不相关任务，只更改用户要求的数据。日期不明确时不要编造；新增任务需要分配不重复的 ID，并更新顶层 `updatedAt`。

## 隐私

此仓库为公开仓库，**网页和任务数据对所有人可见**。不要记录密码、密钥、私人住址、联系方式、私密行程或未经公开的科研内容。需要私密待办时应使用具备访问控制的存储与网站，而不是公开 GitHub Pages。

## 部署与技术

静态 HTML + CSS + JavaScript，不依赖第三方框架、数据库或外部 CDN。在手机上可以收藏页面或加入主屏幕。从 `tasks.json` 读取时使用随机查询参数防止缓存旧数据。页面会在返回可见状态、点击刷新或定时检查时读取 GitHub Pages 发布的数据。

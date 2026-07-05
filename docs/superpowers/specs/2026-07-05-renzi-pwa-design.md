# 认字 PWA（iPad 离线版）设计文档

日期：2026-07-05
状态：已与用户确认

## 1. 背景与目标

现有安卓应用 `com.babyword.learnword`（拍照识字 + SM-2 间隔复习）迁移到 iPad 个人使用，
不经 App Store 发布。用户无 Mac，故采用**离线 PWA** 方案：静态网页托管于 GitHub Pages，
iPad Safari「添加到主屏幕」后全屏、离线运行。

核心功能变更（相对安卓版）：

- 取消「每日新学上限」「每日复习上限」两项设置及新学队列概念；
  新字录入后立即进入复习池，数量不限。
- 复习纯按遗忘规律调度：答错 → 出现更频繁；答对 → 出现更稀疏。
- 取消 OCR：新字由键盘输入（支持批量粘贴），拍照仅作为复习提示图。
- 复习会话不设数量终点：只要还有到期的字就持续供字；
  **没有到期字时提示并结束，不做提前复习**。

## 2. 约束

- 仅 iPad 单设备使用，完全离线，无多设备同步。
- 无 Mac，不做原生 App、不走任何签名/审核流程。
- 需要一次性迁移安卓版已有数据（字、复习进度、提示照片）。

## 3. 总体架构

- 纯静态单页应用，**无构建步骤**：原生 ES Modules + HTML/CSS。
- 第三方库仅两个，下载后放入仓库本地引用（保证离线）：
  - `idb`：IndexedDB Promise 封装
  - `jszip`：备份 zip 的生成与解析
- Service Worker 预缓存全部资源；以版本号触发缓存更新。
- 托管：GitHub Pages（公开仓库，代码无隐私；用户数据只存于 iPad 本机）。
- 发音：Web Speech API `speechSynthesis`，使用 iPad 内置中文语音，离线可用。
- 拍照：`<input type="file" accept="image/*" capture="environment">` 调用相机，
  前端 canvas 压缩至长边 ≤1024px、JPEG 质量 0.7（目标 ~200KB 以内）后存储。

## 4. 数据模型（IndexedDB，库名 `renzi`）

### store: characters（keyPath: id 自增）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 自增主键 |
| char | string | 汉字本身，**唯一索引**，重复录入忽略 |
| photo | Blob \| null | 压缩后的提示照片 |
| learnedAt | number | 录入时间戳（ms） |
| interval | number | 当前复习间隔（天） |
| repetitions | number | 连续记住次数 |
| easeFactor | number | 难度系数，初始 2.5，范围 [1.3, 2.8] |
| nextReviewAt | number | 下次到期时间戳（ms），**索引** |
| totalWrong | number | 累计答错次数 |

### store: reviewLog（keyPath: id 自增）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 自增主键 |
| charId | number | 对应字 id |
| reviewedAt | number | 作答时间戳（ms），**索引** |
| remembered | boolean | 是否记住 |

用途：统计连续学习天数（按本地日期去重后数连续日）与历史数据。

### store: settings（key-value）

仅存杂项：上次备份时间戳等。无每日上限设置。

## 5. 复习调度算法

新字录入：`interval=0, repetitions=0, easeFactor=2.5, nextReviewAt=now` → 立即到期。

会话供字优先级（循环取下一张卡）：

1. 到期字（`nextReviewAt <= now`）：逾期最久优先，同期按 `totalWrong` 降序；
2. 本次会话答错的字：答错后重新插入队列（间隔至少 3 张卡之后），直到答对；
3. 两类均空 → 显示「今天没有需要复习的字」/「全部复习完成」提示页，会话结束。
   **不提供提前复习。**

作答规则（二元）：

- **记住了**：`repetitions += 1`；间隔递增：
  - repetitions=1 → interval = 1 天
  - repetitions=2 → interval = 3 天
  - repetitions≥3 → interval = round(interval × easeFactor)
  - `easeFactor = min(easeFactor + 0.05, 2.8)`
  - `nextReviewAt = now + interval 天`
- **忘了**：`repetitions = 0, interval = 0, nextReviewAt = now`（本会话内重新出现），
  `easeFactor = max(easeFactor - 0.2, 1.3)`，`totalWrong += 1`。

每次作答立即写库并追加 reviewLog；用户任何时刻退出均不丢进度，
未过关的字（interval=0）下次会话自动排在最前。

## 6. 页面结构（单页应用内四个视图）

1. **首页**：今日待复习 N 字（参考信息，非额度）、字库总数、连续学习天数；
   「开始复习」「录入新字」两个主按钮；超过 30 天未备份时显示提醒条。
2. **录入页**：文本框输入汉字，支持一次粘贴多字（自动拆分为单字、去重、忽略非汉字字符）；
   逐字可选拍摄提示照片；显示入库结果（新增 N 个、跳过重复 M 个）。
3. **复习页**：大字卡片；按钮：💡提示（显示照片，无照片则按钮隐藏）、🔊发音、
   ✅记住了、❌忘了；队列清空后显示结束提示页。
4. **字库/设置页**：字列表（字、下次到期、答错次数，可删除单字）；
   「导出备份」（生成 zip 触发下载，存入文件 App）；
   「导入」（选择 zip：恢复备份或迁移安卓数据，同一入口）。

## 7. 备份与迁移

### 备份格式（backup.zip）

```
backup.zip
├── data.json      # { version, exportedAt, characters:[...], reviewLog:[...] }
└── photos/<id>.jpg
```

导出：读全库生成 zip，浏览器下载（iPad 存入文件 App）。
导入：解析 zip，**整库替换**（导入前提示确认）。

### 安卓数据迁移（一次性）

1. PC 端：手机开 USB 调试，利用 debug 包可 `run-as` 的特性拉取数据
   （已从 APK 反编译确认：数据库为 `databases/babyword.db`，照片为 `files/*.jpg`）：
   - `adb exec-out run-as com.babyword.learnword cat databases/babyword.db > babyword.db`
   - 照片同法逐个拉取（脚本自动列目录并循环）
2. 提供 Python 转换脚本（仓库 `tools/migrate_android.py`）：
   读 Room SQLite 的 `character_table`（含 interval / repetitions / ease_factor /
   next_review_at / total_forgotten → totalWrong）与 `review_log`，
   加照片打包为与上述格式一致的 `backup.zip`。
3. iPad 端：zip 传至 iPad（隔空投送/网盘/微信均可），设置页「导入」完成迁移。

## 8. 风险与对策

| 风险 | 对策 |
|------|------|
| 浏览器存储被系统清理 | 主屏幕 Web App 不受 Safari 7 天策略影响；启动时调用 `navigator.storage.persist()`；30 天未备份提醒 |
| speechSynthesis 中文语音不可用 | 发音为增强功能，失败静默降级（按钮置灰），不影响复习 |
| 照片占用存储 | 录入时压缩至 ~200KB；字库页显示总占用 |
| GitHub Pages 不可达 | 仅影响更新，已安装的 PWA 离线照常运行 |

## 9. 测试

- 单元测试（Node 直接运行，无框架依赖或用 node:test）：
  调度算法（间隔/难度系数/答错重置/队列排序）、备份导出导入往返一致性、
  批量录入的拆字去重。
- 迁移脚本：用真实安卓拉取的数据验证一遍。
- 界面：iPad Safari 人工验收（安装、离线启动、拍照、发音、导入导出）。

## 10. 明确不做（YAGNI）

- OCR 识字、笔顺/拼音展示、推送通知、多设备同步、云端账号、
  提前复习、复习历史图表。

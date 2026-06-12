# PPL训练 — 增肌训练记录工具 (v2)

一个面向 iPhone 的 PWA 训练记录应用。基于 PPL（推-拉-腿）四分化循环的增肌训练计划，支持离线记录、云端同步、周期管理和渐进超负荷提醒。

## 快速开始

```bash
cd ppl-training
npm install
npm run dev        # 开发服务器 http://localhost:5173
npm run test       # 57 个单元测试
npm run build      # 生产构建 → dist/
```

## 一键部署

### 部署到 Vercel（推荐）

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new)

1. 将项目 push 到 GitHub 仓库
2. 在 [vercel.com](https://vercel.com) 导入该仓库
3. 框架选择 **Vite**，输出目录 `dist`
4. 在 Environment Variables 添加：

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

5. 部署后即可通过 `https://your-app.vercel.app` 访问

### 部署到 Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

1. 同上，push 到 GitHub
2. 在 [netlify.com](https://netlify.com) 导入
3. 构建命令：`npm run build`，发布目录：`dist`
4. 在 Site Settings → Environment Variables 添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

### 部署后使用 PWA

1. iPhone 打开部署后的网址
2. 点击 Safari 分享按钮（□↑）
3. 向下滑动选择 **"添加到主屏幕"**
4. 确认名称后，主屏幕出现图标
5. 后续直接从主屏幕打开，无需开电脑终端

离线功能在首次联网加载后自动可用。

## Supabase 配置

Supabase 是可选的。不配置也能完全使用本地模式。

### 创建 Supabase 项目

1. 在 [supabase.com](https://supabase.com) 注册并创建项目
2. 进入 **SQL Editor**，粘贴执行 `src/supabase/schema.sql` 的全部内容
3. 在 **Project Settings → API** 中获取：
   - `Project URL`
   - `anon public key`

### 环境变量

在项目根目录创建 `.env` 文件：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

部署平台的环境变量配置同上。

### 同步状态说明

| 状态 | 说明 |
|------|------|
| 本地模式 | 未配置 Supabase，数据仅存本地 |
| 未登录 | 已配置但未登录 |
| 已同步 | 云端已是最新 |
| 同步中 | 正在上传/下载 |
| 待同步 | 有本地更改未上传 |
| 同步失败 | 网络错误，可重试 |

## 功能特性

### 训练记录
- 热身组 + 正式组记录
- 重量/次数输入，手机数字键盘适配
- ±2.5kg 快捷，复制上组重量
- ±1 次快捷
- 每项可跳过、替换、新增动作

### 自动休息计时
- 完成后自动倒计时
- 震动 + 声音提醒
- ±15秒调整，跳过休息

### 渐进超负荷
- 连续两组达到目标上限自动弹窗
- 建议 +2.5kg 或 +5kg
- 支持自定义增重
- 长期停滞检测提醒

### 周期管理
- 8周一周期，从首次使用自动计算
- 第5周：动作替换建议
- 第6周：全面调整建议
- 第8周：减载周（降重40%，组数减半）
- 提醒可暂缓或永久关闭

### 训练顺延
- 推→拉→腿→复合→推 自动循环
- 不按固定周几，按实际完成顺延
- 可手动切换训练日

### 可编辑计划
- 每个训练日可增删改动作
- 调整组数、次数范围、休息时间、热身组
- 替换动作时按同肌群推荐
- 自定义动作
- 训练中可临时替换/新增

### 训练总结
- 总用时、总容量、完成动作/组数
- 对比上次同训练日进步
- 每个动作的容量/重量变化
- 下次训练推荐

### 历史记录
- 按日期倒序
- 查看每组重量/次数/完成状态

### 走势分析
- 基于实际历史动态生成动作列表
- 容量曲线、最高重量曲线、最佳次数曲线
- 支持搜索

### 离线可用
- 数据存于 Dexie (IndexedDB)
- 离线可完整记录、查看历史
- 联网后自动同步

## 项目结构

```
ppl-training/
├── src/
│   ├── db/               # Dexie 数据库 + 种子数据 + 动作库
│   ├── lib/              # 核心业务逻辑（周期、递进、容量）
│   ├── pages/            # 所有页面组件
│   │   ├── TodayPage         # 首页
│   │   ├── WorkoutPage       # 训练执行（核心）
│   │   ├── SummaryPage       # 训练总结
│   │   ├── HistoryPage       # 历史列表
│   │   ├── HistoryDetailPage # 历史详情
│   │   ├── TrendsPage        # 走势图
│   │   ├── SettingsPage      # 设置
│   │   ├── EditPlanPage      # 计划编辑（新增）
│   │   └── AuthPage          # 登录
│   ├── supabase/         # Supabase 客户端 + 同步
│   ├── hooks/            # React Context
│   └── __tests__/        # 单元测试
├── vercel.json           # Vercel 部署配置
├── netlify.toml          # Netlify 部署配置
└── README.md
```

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **样式**: Tailwind CSS
- **离线存储**: Dexie.js (IndexedDB v2)
- **图表**: Recharts
- **云后端**: Supabase (Auth + PostgreSQL)
- **PWA**: vite-plugin-pwa (Service Worker + Manifest)
- **部署**: Vercel / Netlify
- **测试**: Vitest (57 tests)

## 内置动作库

预置 60+ 常见健身房动作，按肌群和器械分类，支持替换推荐和自定义创建。

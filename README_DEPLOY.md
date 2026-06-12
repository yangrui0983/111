# PPL训练 — 部署指南

## 为什么需要部署？

用 `npm run dev` 启动开发服务器的方式只能在本机或同一 WiFi 下使用：

- ❌ 电脑不能关机
- ❌ 手机离开家/WiFi 就无法访问
- ❌ 每次使用都要先开终端

**部署后：**

- ✅ 电脑可以关机
- ✅ 手机用 4G/5G 也能访问
- ✅ 不需要开任何终端
- ✅ 添加到主屏幕后和原生 App 一样用

## 部署到 Vercel（推荐，免费）

### 步骤

**1. 注册 Vercel**

打开 [vercel.com](https://vercel.com)，用 GitHub 或邮箱注册。

**2. 安装 Vercel CLI（可选，但推荐）**

```bash
npm i -g vercel
```

**3. 在项目目录执行部署**

```bash
cd ppl-training
vercel --prod
```

按照提示登录并确认。Vercel 会自动识别框架为 Vite，几秒后就部署好了。

你会得到类似这样的网址：

```
https://ppl-training.vercel.app
```

**4. 手机打开部署的网址**

iPhone Safari 打开这个链接 → 点分享按钮 → **添加到主屏幕**。

以后直接从主屏幕打开，和原生 App 一样。

### 有 GitHub 仓库的方式

1. 把代码 push 到 GitHub
2. 在 vercel.com 点击 "Add New Project"
3. 导入你的仓库
4. 框架选 **Vite**，输出目录 **dist**
5. 点击 Deploy

## 部署到 Netlify

1. 在 [netlify.com](https://netlify.com) 注册
2. 点击 "Add new site" → "Import an existing project"
3. 连接你的 Git 仓库
4. Build command: `npm run build`
5. Publish directory: `dist`
6. 点击 "Deploy site"

## 配置 Supabase（可选，用于云同步）

不配置 Supabase 也能用，数据保存在手机本地。

需要云同步时才配置：

1. 在 [supabase.com](https://supabase.com) 创建项目
2. SQL Editor 中执行 `src/supabase/schema.sql`
3. 在 Vercel/Netlify 项目设置中添加环境变量：

```
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_ANON_KEY=你的匿名密钥
```

4. 重新部署后，应用内会出现登录/注册入口

## 如何确认部署成功？

- 打开部署后的网址，能正常看到首页
- iPhone Safari 可以添加到主屏幕
- **断网后再次打开**，仍然能看到首页（离线缓存生效）
- 未登录状态下可以正常开始训练、记录组数
- 登录后数据同步到云端

## 常见问题

**Q: 部署后有更新怎么办？**

重新执行 `vercel --prod` 或 push 到 GitHub（自动部署）。

**Q: 不用终端的话，本地开发怎么用？**

开发用 `npm run dev`，部署后用户用线上地址。

**Q: 需要买域名吗？**

不需要。Vercel 提供免费的 `.vercel.app` 域名。

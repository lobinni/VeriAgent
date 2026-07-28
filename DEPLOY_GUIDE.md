# VeriAgent — Hướng dẫn Deploy lên GitHub & Vercel (`veri-agent.vercel.app`)

> 🌐 **Live Web Application:** [https://veri-agent.vercel.app](https://veri-agent.vercel.app)

---

## Bước 1: Push lên GitHub

Repository đã được init và commit đầy đủ code. Bạn cần tạo repo trên GitHub rồi push:

### Tạo repo mới trên GitHub
1. Mở https://github.com/new
2. Repository name: **VeriAgent** (hoặc tên tùy chọn của bạn)
3. Description: `On-chain verification protocol for autonomous AI agents, built on GenLayer Studio`
4. Chọn **Public**
5. ❌ KHÔNG check "Add a README" (đã có sẵn)
6. ❌ KHÔNG check ".gitignore" (đã có sẵn)
7. Click **Create repository**

### Push code lên GitHub
```bash
# Thêm remote origin (thay YOUR_USERNAME bằng username GitHub của bạn)
git remote add origin https://github.com/YOUR_USERNAME/VeriAgent.git

# Push code lên nhánh main
git push -u origin main
```

Nếu dùng SSH:
```bash
git remote add origin git@github.com:YOUR_USERNAME/VeriAgent.git
git push -u origin main
```

---

## Bước 2: Deploy trên Vercel với tên miền `veri-agent.vercel.app`

### Cách 1: Qua Vercel Dashboard (Khuyên dùng)
1. Mở https://vercel.com/new
2. Click **"Import Git Repository"**
3. Chọn repo **VeriAgent** vừa push từ danh sách
4. Cấu hình deploy:
   - **Project Name:** Nhập `veri-agent` (để Vercel tự gán tên miền `veri-agent.vercel.app`, hoặc nếu tên miền đã bị chiếm thì bạn có thể chọn `veriagent-protocol`, `veri-agent-app`...)
   - **Framework Preset:** Next.js (Vercel tự detect)
   - **Build Command:** `npm run build` (mặc định)
   - **Output Directory:** `.next` (mặc định cho Next.js)
   - **Install Command:** `npm install` (mặc định)
5. Click **Deploy**

### Cách 2: Qua Vercel CLI
```bash
# Cài đặt Vercel CLI (nếu chưa có)
npm i -g vercel

# Đăng nhập vào Vercel
vercel login

# Liên kết và deploy lên production
vercel --prod
```

Khi Vercel hỏi `What’s your project’s name?`, nhập `veri-agent` để nhận domain `veri-agent.vercel.app`.

---

## Bước 3: Cấu hình Environment Variables trên Vercel (Tùy chọn)

Do địa chỉ contract `0xb91f66881b27EA184c92468579dCFcB0F39bDFE4` trên mạng **GenLayer Studio (chain id 61999)** đã được đóng gói sẵn (baked in) làm mặc định trong code, ứng dụng của bạn sẽ hoạt động ngay lập tức trên Vercel mà không cần cấu hình gì thêm!

Tuy nhiên, nếu sau này bạn muốn đổi sang contract khác hoặc mạng khác, bạn có thể thiết lập biến môi trường trên Vercel:

Qua Vercel Dashboard:
1. Vào **Project Settings → Environment Variables**
2. Thêm:

| Key | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_VERIAGENT_CONTRACT_ADDRESS` | `0xb91f66881b27EA184c92468579dCFcB0F39bDFE4` | Production, Preview, Development |

3. Click **Save**
4. Trigger redeploy: **Deployments → Latest → Redeploy**

Hoặc qua CLI:
```bash
vercel env add NEXT_PUBLIC_VERIAGENT_CONTRACT_ADDRESS production
# Paste: 0xb91f66881b27EA184c92468579dCFcB0F39bDFE4
vercel --prod  # redeploy với biến môi trường mới
```

---

## Bước 4: Kiểm tra và sử dụng Live App

Sau khi Vercel build xong, mở **[https://veri-agent.vercel.app](https://veri-agent.vercel.app)** và kiểm tra:
- ✅ **Giao diện:** Teal/Navy verification theme hiện đại, Logo Shield + "Veri**Agent**".
- ✅ **Thông tin Contract:** Hiển thị `0xb91f66881b27EA184c92468579dCFcB0F39bDFE4` trên mạng **GenLayer Studio**.
- ✅ **Kết nối MetaMask:** Click "Connect wallet" → Ví tự động yêu cầu chuyển / thêm mạng **GenLayer Studio** (chain id 61999, currency GEN, RPC `https://studio.genlayer.com/api`).
- ✅ **Luồng liên mạch 3 bước (Seamless Workflow):**
  1. **Register an agent:** Nhập tên và manifest URL → Bấm "Register agent" → Giao diện tự động chọn ID vừa tạo và chuyển sang tab Evaluate.
  2. **Request an evaluation:** Dùng mẫu kiểm định có sẵn → Bấm "Request evaluation" → Validator của GenLayer chạy LLM consensus → Giao diện tự động chuyển sang tab Endorse.
  3. **Endorse an agent:** Điền số lượng `0.05 GEN` → Bấm "Endorse agent" → Hoàn tất hồ sơ kiểm định on-chain!

---

## Cấu trúc dự án

```
├── vercel.json          ← Vercel config (framework: nextjs)
├── package.json         ← name: "veriagent", scripts: { build: "next build" }
├── next.config.ts       ← Next.js config
├── tsconfig.json        ← TypeScript ES2020 (hỗ trợ BigInt)
├── src/
│   ├── app/
│   │   ├── page.tsx           ← dynamic({ ssr: false }) client wrapper
│   │   ├── VeriAgentAppContent.tsx ← Toàn bộ giao diện người dùng
│   │   ├── layout.tsx         ← SEO metadata + OpenGraph cho veri-agent.vercel.app
│   │   ├── globals.css        ← Bảng màu Teal/Navy verification
│   │   └── api/
│   │       ├── health/route.ts
│   │       └── verify/route.ts ← Endpoint kiểm tra kết nối RPC
│   ├── components/     ← 8 React components (Header, Registry, Console, Docs...)
│   ├── hooks/          ← 3 hooks (useWallet tự thêm mạng Studio, useTx, useContractData)
│   └── lib/            ← config, genlayer (client & mapping), format, examples
├── contracts/
│   └── veriagent.py    ← GenLayer Intelligent Contract
├── scripts/            ← deploy.mjs, seed.mjs, read.mjs
├── public/
│   └── favicon.svg     ← Shield verification logo
└── tests/
    └── direct/
        └── test_veriagent.py
```

---

## Lưu ý quan trọng

- ❌ KHÔNG thiết lập `DATABASE_URL` trên Vercel (dự án hoạt động phi tập trung 100% trực tiếp với smart contract trên GenLayer Studio thông qua RPC).
- ✅ Biến môi trường duy nhất là `NEXT_PUBLIC_VERIAGENT_CONTRACT_ADDRESS` (không bắt buộc vì đã có giá trị mặc định trong `src/lib/config.ts`).
- ✅ Ứng dụng tương thích hoàn toàn với Vercel Edge & Serverless Runtimes.

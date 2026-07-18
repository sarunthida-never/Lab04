# Cheat Note — คำสั่งที่ใช้ใน Lab นี้

## npm scripts
```bash
npm install          # ติดตั้ง dependencies (ต้องรันก่อนถึงจะ npm test ได้)
npm test              # รัน jest ทั้งหมด (29 tests)
npm run typecheck     # tsc --noEmit เช็ค type อย่างเดียว ไม่ build ไฟล์ออก
npm run build         # tsc คอมไพล์เป็น dist/
npm run dev           # tsx watch src/index.ts รัน dev server ที่ localhost:3000
```

## Claude Code slash commands
```
/init      # สร้าง CLAUDE.md จากการวิเคราะห์โครงสร้างโปรเจกต์ทั้งหมด
/plan      # เข้า plan mode — วางแผนก่อนแก้โค้ดจริง ต้อง ExitPlanMode ถึงจะเริ่มแก้ได้
/context   # ดูสัดส่วนการใช้ context window ของ session ปัจจุบัน
```

## ตรวจสอบ JSON syntax ด้วย jq
```bash
jq . .claude/settings.json    # เช็คว่าไฟล์ settings.json syntax ถูกต้อง
```

## สิ่งที่ทำไปใน lab นี้
1. `/init` → สร้าง `CLAUDE.md` อธิบายสถาปัตยกรรม checkout-service (routes → services → repositories, `withLock`, idempotency, coupon rules)
2. สร้าง `.claude/settings.json` — `permissions.allow` สำหรับ `npm run dev` / `npm test` / `npm run test` / `jest *`, `permissions.deny` สำหรับอ่าน `.env` และ `rm -rf *`
3. เช็ค `.gitignore` — พบว่า `.claude/settings.local.json` ถูก ignore อยู่แล้ว
4. `npm install` แล้ว `npm test` → เขียวทั้ง 6 test suites (29 tests)
5. `/plan` → เพิ่ม JSDoc ให้ฟังก์ชัน `doCheckout` ใน `src/services/orderService.ts` (ไม่แก้ logic) แล้วเช็คด้วย `npm run typecheck`

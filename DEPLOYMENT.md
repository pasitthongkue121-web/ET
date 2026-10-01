# ENERGY TWINS AI — Easy Access & Public Deployment Guide

คู่มือฉบับสมบูรณ์สำหรับการเข้าถึงระบบ **ENERGY TWINS AI** อย่างง่ายดาย และการเปิดใช้งานสู่สาธารณะ (Public Access) ทั่วโลก

---

## 🚀 สรุปวิธีเปิดใช้งานด่วน (Quick Start)

| วิธีการเข้าถึง | ความสะดวก | การใช้งาน | คำสั่ง / ไฟล์ที่รัน |
| :--- | :---: | :--- | :--- |
| **1. เปิดใช้งานในเครื่อง (Localhost)** | ⚡ 1-Click | สำหรับเปิดใช้งานบนคอมพิวเตอร์ของคุณเอง | ดับเบิลคลิก `start.bat` |
| **2. เปิดสู่สาธารณะทั่วโลก (Public HTTPS)** | 🌐 1-Click | ได้ลิงก์ HTTPS ฟรี เข้าถึงได้จากมือถือ/แท็บเล็ตทั่วโลก | ดับเบิลคลิก `start_public.bat` |
| **3. แชร์ในวง Wi-Fi เดียวกัน (LAN)** | 📱 สะดวก | เปิดจากมือถือ/iPad ในบ้านวง Wi-Fi เดียวกัน | ดู IP ในเทอร์มินัล (เช่น `http://192.168.1.50:3000`) |
| **4. ปิดเซิร์ฟเวอร์ทั้งหมด** | 🛑 1-Click | ปิด Background Process ทั้งหมดอย่างปลอดภัย | ดับเบิลคลิก `stop.bat` |

---

## 🌐 วิธีที่ 1: 1-Click Public HTTPS Tunnel (แนะนำที่สุด - ฟรี 100%)

ระบบได้ติดตั้งตัวสร้าง **Cloudflare Quick Tunnel** มาให้พร้อมใช้งานในโฟลเดอร์ `bin/cloudflared.exe` คุณไม่จำเป็นต้องสมัครบัญชี ไม่ต้องตั้งค่า Forward Port และไม่ต้องมีโดเมนส่วนตัว

### ขั้นตอน:
1. ดับเบิลคลิกไฟล์ **`start_public.bat`** (หรือรัน `python public_tunnel.py` ใน Terminal)
2. ระบบจะทำการ:
   - ตรวจสอบและสตาร์ต Backend (FastAPI พอร์ต 8000)
   - ตรวจสอบและสตาร์ต Frontend (Next.js พอร์ต 3000)
   - สร้าง Secure HTTPS Tunnel สู่ Cloudflare Network
3. ในหน้าต่างจะแสดงลิงก์สาธารณะ เช่น:
   ```
   ====================================================================
          ⚡ ENERGY TWINS AI — ONLINE & PUBLIC ACCESS READY ⚡
   ====================================================================
     🏠 Local Access:       http://localhost:3000
     📱 Wi-Fi Network:      http://192.168.1.120:3000
     🌐 PUBLIC HTTPS URL:   https://ac-twins-sample.trycloudflare.com
        (Accessible worldwide from any smartphone, laptop, or tablet!)
   ====================================================================
   ```
4. **ส่งลิงก์ `https://....trycloudflare.com` ให้ผู้อื่นเปิดบนมือถือหรือคอมพิวเตอร์เครื่องใดก็ได้ในโลกได้ทันที!**

> **หมายเหตุ:** Next.js ถูกตั้งค่าเป็น Reverse Proxy อัตโนมัติ (`next.config.ts`) ทำให้การเรียก API จากภายนอกผ่านพอร์ตเดียว ไม่ติดปัญหา CORS หรือ Mixed Content (HTTPS/HTTP)

---

## 📱 วิธีที่ 2: การเข้าใช้งานผ่านเครือข่าย Wi-Fi ในบ้าน (LAN Access)

หากต้องการเปิดดูบนมือถือหรือ iPad ที่เชื่อมต่อ Wi-Fi เดียวกันในบ้าน:
1. ดับเบิลคลิก `start.bat`
2. ตรวจสอบ IP Address ของเครื่องคอมพิวเตอร์ของคุณ (เปิด CMD แล้วพิมพ์ `ipconfig` หรือดูที่เทอร์มินัลของ `public_tunnel.py`)
3. เปิดเบราว์เซอร์ในมือถือ แล้วพิมพ์:
   ```
   http://<IP_เครื่องของคุณ>:3000
   ```
   *ตัวอย่าง: `http://192.168.1.120:3000`*

---

## ☁️ วิธีที่ 3: การ Deploy บน Cloud แบบถาวร (Production Hosting)

### ทางเลือก A: Render.com (ฟรี Web Service)
1. Push โค้ดนี้ขึ้น GitHub Repository
2. เข้าสู่ระบบ [Render.com](https://render.com) &rarr; คลิก **New +** &rarr; เลือก **Web Service**
3. **Backend Service**:
   - Environment: `Python 3`
   - Build Command: `pip install -r backend/requirements.txt scikit-learn scipy`
   - Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. **Frontend Service (Static หรือ Web Service)**:
   - Environment: `Node`
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
   - Environment Variable: `INTERNAL_BACKEND_URL=https://<your-backend-render-url>.onrender.com`

### ทางเลือก B: Railway.app (รองรับ Docker Compose ในคลิกเดียว)
1. ติดตั้ง Railway CLI หรือเชื่อมต่อ GitHub
2. ระบบจะตรวจพบ `docker-compose.yml` อัตโนมัติและ Deploy ทั้ง Backend และ Frontend ขึ้นคลาวด์ทันที

---

## 🐳 วิธีที่ 4: การรันด้วย Docker

หากคุณมี Docker ติดตั้งอยู่ในเครื่องหรือบน VPS:

```bash
# สตาร์ตทั้งระบบแบบ Background
docker compose up -d --build

# ดูสถานะ Container
docker compose ps

# ปิดระบบ
docker compose down
```

เปิดเบราว์เซอร์ที่: **`http://localhost:3000`**

---

## 🛠️ ไฟล์และสคริปต์อำนวยความสะดวกในโปรเจกต์

- **`start.bat`**: สคริปต์คลิกเดียวสำหรับเปิดใช้งาน Localhost + เปิดเบราว์เซอร์อัตโนมัติ
- **`start_public.bat`**: สคริปต์คลิกเดียวสำหรับเปิดสู่สาธารณะทั่วโลกด้วย Cloudflare Tunnel
- **`stop.bat`**: สคริปต์คลิกเดียวสำหรับปิด Service ทั้งหมดในเครื่อง
- **`public_tunnel.py`**: Python Runner จัดการสร้าง URL สาธารณะแบบ Real-time
- **`bin/cloudflared.exe`**: Portable Binary สำหรับทำ Secure Tunneling
- **`docker-compose.yml`**: ไฟล์ตั้งค่ารัน Multi-container Docker

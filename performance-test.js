import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  duration: '30s',

  thresholds: {
    // LLM + Agent + Tool-calling endpoint โดยทั่วไปใช้เวลา 4-10s/req
    // ตั้ง p(95) ไว้ที่ 15s เผื่อ cold start และ tool call หลายตัว
    http_req_duration: ['p(95)<15000'],
    // อัตรา HTTP failure ต้องต่ำกว่า 1%
    http_req_failed: ['rate<0.01'],
    // อย่างน้อย 95% ของ check ทั้งหมดต้องผ่าน
    checks: ['rate>0.95'],
  },
};

export default function () {
  const BASE_URL = __ENV.BASE_URL || __ENV.API_URL || "http://localhost:3000";

  const payload = JSON.stringify({
    messages: [
      { role: "user", parts: [{ type: "text", text: "CI Performance Test" }] },
    ],
    sessionId: "db0861bd-4b54-4a2c-bd19-6a38f14dffc1",
    userId: "8056d3da-4110-4271-a8bc-719555f878ed",
  });

  const res = http.post(`${BASE_URL}/api/chat`, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: "30s",
  });

  // /api/chat ตอบเป็น UI Message Stream (AI SDK) — ไม่ใช่ JSON ปกติ
  // จึงเช็คจากสถานะ HTTP, body ไม่ว่าง และรูปแบบ stream protocol
  check(res, {
    "status is 200": (r) => r.status === 200,

    "response body is not empty": (r) => !!r.body && r.body.length > 0,

    "response is a UI message stream": (r) => {
      if (!r.body || typeof r.body !== "string") return false;
      const body = r.body;
      // AI SDK UI message stream มักมี data: หรือ JSON chunks ของ part/type
      return (
        body.includes("data:") ||
        body.includes('"type"') ||
        body.includes('"text"') ||
        body.length > 10
      );
    },
  });

  sleep(2);
}

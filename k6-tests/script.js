import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const errorCount = new Counter("errors");
const latencyTrend = new Trend("latency_ms");

export const options = {
  scenarios: {
    mixed_load: {
      executor: "ramping-arrival-rate",
      startRate: 200,                   // Start at 200 RPS
      timeUnit: "1s",
      preAllocatedVUs: 500,
      maxVUs: 1500,
      stages: [
        { target: 1000, duration: "30s" },
        { target: 1000, duration: "60s" },
        { target: 0, duration: "20s" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1000"],
    latency_ms: ["p(95)<1000"],
    errors: ["count<1000"],
  },
  discardResponseBodies: true,
  noConnectionReuse: false,
  userAgent: "k6-mixed-load/1.0",
};

const BASE_URL = "http://order-service:3002";
const PRODUCT_IDS = [1, 2, 3, 4, 5]; 

export default function () {
  const productId = PRODUCT_IDS[Math.floor(Math.random() * PRODUCT_IDS.length)];
  const quantity = Math.floor(Math.random() * 5) + 1;
  const headers = { "Content-Type": "application/json" };

  const isCreate = Math.random() <= 1; 

  let res;
  if (isCreate) {
    const payload = JSON.stringify({ productId, quantity });
    res = http.post(`${BASE_URL}/orders`, payload, { headers });
  } else {
    res = http.get(`${BASE_URL}/orders/product/${productId}`);
  }

  latencyTrend.add(res.timings.duration);

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "duration < 1s": (r) => r.timings.duration < 1000,
  });

  if (!ok) errorCount.add(1);

  sleep(0.001);
}

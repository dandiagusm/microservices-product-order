import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";

const errorCount = new Counter("errors");
const latencyTrend = new Trend("latency_ms");

export const options = {
  scenarios: {
    steady_load: {
      executor: "constant-arrival-rate",
      rate: 1000,             // 1000 requests per second
      timeUnit: "1s",
      duration: "1m",         
      preAllocatedVUs: 500,   
      maxVUs: 1000,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"], 
    http_req_duration: ["p(95)<1000"], 
    latency_ms: ["p(95)<1000"],
    errors: ["count<1000"],
  },
  discardResponseBodies: true,
};

const BASE_URL = "http://order-service:3002";
const PRODUCT_IDS = [1]; 

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
}

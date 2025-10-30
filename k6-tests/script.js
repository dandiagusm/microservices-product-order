import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const errorCount = new Counter("errors");
const latencyTrend = new Trend("latency_ms");

export const options = {
  scenarios: {
    high_load: {
      executor: "ramping-arrival-rate", // gradually ramp to avoid massive initial spike
      startRate: 200,                   // start at 200 RPS
      timeUnit: "1s",
      preAllocatedVUs: 500,             // initial VUs
      maxVUs: 1500,                      // auto-scale limit
      stages: [
        { target: 1000, duration: "30s" }, // ramp up to 1000 RPS in 30s
        { target: 1000, duration: "60s" }, // sustain 1000 RPS for 1 min
        { target: 0, duration: "20s" },    // ramp down
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],   // <5% requests fail
    http_req_duration: ["p(95)<1000"], // 95% requests < 1s
    errors: ["count<1000"],           // <1000 total errors
    latency_ms: ["p(95)<1000"],       // custom latency metric
  },
  discardResponseBodies: true,        // save memory
  noConnectionReuse: false,           // allow keep-alive
  userAgent: "k6-load-test/1.0",
};

const BASE_URL = "http://order-service:3002/orders";

const PRODUCT_ID = parseInt(__ENV.PRODUCT_ID || "2");

export default function () {
  const payload = JSON.stringify({ productId: PRODUCT_ID, quantity: 1 });
  const headers = { "Content-Type": "application/json" };

  const res = http.post(BASE_URL, payload, { headers });

  // Record latency
  latencyTrend.add(res.timings.duration);

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "duration < 1s": (r) => r.timings.duration < 1000,
  });

  if (!ok) errorCount.add(1);

  sleep(0.001); 
}

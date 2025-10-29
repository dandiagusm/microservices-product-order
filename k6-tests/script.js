import http from "k6/http";
import { check } from "k6";

// Configure load test
export const options = {
  scenarios: {
    high_load: {
      executor: "constant-arrival-rate",
      rate: 1000,            // 1000 requests per second
      timeUnit: "1s",        // per second
      duration: "30s",       // run for 30 seconds
      preAllocatedVUs: 500,  // initial virtual users
      maxVUs: 2000,          // max virtual users allowed
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // less than 1% errors
    http_req_duration: ["p(95)<500"], // 95% of requests below 500ms
  },
};

const BASE_URL = "http://order-service:3002/orders";

export default function () {
  const payload = JSON.stringify({
    productId: 1,
    quantity: 1,
  });

  const headers = { "Content-Type": "application/json" };

  const res = http.post(BASE_URL, payload, { headers });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });
}

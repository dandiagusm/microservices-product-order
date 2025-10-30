import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    high_load: {
      executor: "constant-arrival-rate",
      rate: 1000,            
      timeUnit: "5s",        
      duration: "30s",      
      preAllocatedVUs: 500,  
      maxVUs: 1000,        
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // less than 1% errors
    http_req_duration: ["p(95)<1000"], // 95% of requests below 1s
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
    "response time < 1s": (r) => r.timings.duration < 1000,
  });
}

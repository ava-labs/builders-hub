# Load Testing Report: `/api/register-form` Endpoint – Vercel Deployment

**Tool used:** [Autocannon](https://github.com/mcollina/autocannon)  
**Target URL:** `https://avalanche-docs-eight.vercel.app/api/register-form`  
**Testing Strategy:** Progressive ramp-up — gradually increasing concurrency levels (50 → 300) using a fixed email list.

---

## 🧪 Phase 1: 50 Connections, 2s Duration

- **Total Requests:** 376
- **Successful (2xx):** 142
- **Failures (non-2xx):** 21
- **Avg Latency:** 704.94 ms
- **Max Latency:** 1205 ms
- **Req/sec Avg:** 81.5
- **Throughput Avg:** 109 kB/s
- **Data Read:** 218 kB

✅ **Interpretation:**  
Performance is solid with low concurrency, though ~15% of requests fail. Latency under 1.2s suggests backend capacity is not saturated yet.

---

## 🧪 Phase 2: 100 Connections, 5s Duration

- **Total Requests:** 1000
- **Successful (2xx):** 499
- **Failures (non-2xx):** 48
- **Avg Latency:** 1495.3 ms
- **Max Latency:** 3253 ms
- **Req/sec Avg:** 109.4
- **Throughput Avg:** 143 kB/s
- **Data Read:** 714 kB

🟡 **Interpretation:**  
Latency doubles and maxes above 3s. Backend begins struggling under double the load, though throughput scales acceptably.

---

## 🧪 Phase 3: 200 Connections, 8s Duration

- **Total Requests:** 2000
- **Successful (2xx):** 685
- **Failures (non-2xx):** 63
- **Avg Latency:** 2512.96 ms
- **Max Latency:** 7350 ms
- **Req/sec Avg:** 93.5
- **Throughput Avg:** 122 kB/s
- **Data Read:** 975 kB

🔶 **Interpretation:**  
System stress is visible: latency averages over 2.5s and spikes above 7s. Failure rate grows. Performance is acceptable but approaching degradation thresholds.

---

## 🧪 Phase 4: 300 Connections, 10s Duration

- **Total Requests:** 2000
- **Successful (2xx):** 750
- **Failures (non-2xx):** 63
- **Avg Latency:** 3382.86 ms
- **Max Latency:** 9748 ms
- **Req/sec Avg:** 81.3
- **Throughput Avg:** 106 kB/s
- **Data Read:** 1.06 MB
- **Errors:** 29 (timeouts)

❌ **Interpretation:**  
Backend under clear saturation. Latency averages over 3.3s, maxes near 10s. Error count and timeout rate indicate unstable capacity at this level.

---

## 📊 Summary & Observations

| Concurrency | Status   | Notes                                |
|-------------|----------|---------------------------------------|
| 50          | ✅ Stable | Minor failures, good latency          |
| 100         | 🟡 OK     | Growing failures, stable throughput   |
| 200         | ⚠️ Risk   | High latency, heavier load strain     |
| 300         | ❌ Fail   | Timeout errors, throughput plateau     |

📦 **Data Summary**

- **Total Requests Sent:** ~5,376  
- **Total Successful (2xx):** 2076  
- **Total Failures:** 195  
- **Timeouts:** 29  
- **Total Data Read:** 3.0 MB

📈 System shows good linear scalability up to ~100 connections, then starts to degrade. Beyond 200, request failures and latency spikes increase sharply. Performance tuning and DB connection scaling may be required.


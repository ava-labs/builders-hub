# Load Testing Report: `/api/project` Endpoint – Vercel Deployment

**Tool used:** [Autocannon](https://github.com/mcollina/autocannon)  
**Target URL:** `https://avalanche-docs-eight.vercel.app/api/project`  
**Testing Strategy:** Progressive ramp-up — gradually increasing concurrency levels (50 → 300) to evaluate performance under load.

---

## 🧪 Phase 1: 50 Connections, 2s Duration

- **Total Requests:** 214
- **Avg Latency:** 988.2 ms
- **Max Latency:** 1984 ms
- **Req/sec Avg:** 41
- **Throughput Avg:** 64.6 kB/s
- **Data Read:** 129 kB

✅ **Interpretation:**  
Low concurrency performs reliably. Latency is under 2s with acceptable throughput. System is stable under minimal stress.

---

## 🧪 Phase 2: 100 Connections, 5s Duration

- **Total Requests:** 1000
- **Avg Latency:** 1562.85 ms
- **Max Latency:** 3958 ms
- **Req/sec Avg:** 101.6
- **Throughput Avg:** 160 kB/s
- **Data Read:** 801 kB

🟡 **Interpretation:**  
System handles twice the load well, but latency increases. Still scalable, but response time is noticeably rising.

---

## 🧪 Phase 3: 200 Connections, 8s Duration

- **Total Requests:** 2000
- **Avg Latency:** 2608.22 ms
- **Max Latency:** 7930 ms
- **Req/sec Avg:** 89.5
- **Throughput Avg:** 141 kB/s
- **Data Read:** 1.13 MB

🔶 **Interpretation:**  
At 200 users, signs of saturation begin. High latency spikes and variability indicate backend stress. Further load could degrade stability.

---

## 🧪 Phase 4: 300 Connections, 10s Duration

- **Total Requests:** 1000
- **Avg Latency:** 3754.13 ms
- **Max Latency:** 9901 ms
- **Req/sec Avg:** 42.7
- **Throughput Avg:** 67.3 kB/s
- **Data Read:** 673 kB
- **Errors:** 80 timeouts

❌ **Interpretation:**  
System hits scalability ceiling. Nearly 4s average latency and almost 10s max. Throughput collapses and timeouts appear — clear overload.

---

## 📊 Summary & Observations

| Concurrency | Status   | Notes                                   |
|-------------|----------|------------------------------------------|
| 50          | ✅ Stable | Responsive, low latency                  |
| 100         | 🟡 OK     | Slower but acceptable                    |
| 200         | ⚠️ Risk   | Latency spikes, variability growing      |
| 300         | ❌ Fail   | Timeouts, unstable, poor responsiveness  |

📦 **Data Summary**

- **Total Requests Sent:** ~4,214  
- **Total Data Read:** ~2.73 MB  
- **Errors (Timeouts):** 80

📈 The `/api/project` endpoint is performant under moderate load but unstable at high concurrency. Ideal throughput is reached between 100–200 users; consider backend tuning or load balancing to scale further.

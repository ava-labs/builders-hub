# Load Testing Report: `/hackathons` Endpoint – Vercel Deployment

**Tool used:** [Autocannon](https://github.com/mcollina/autocannon)  
**Target URL:** `https://avalanche-docs-eight.vercel.app/hackathons`  
**Testing Strategy:** Progressive ramp-up — gradually increasing concurrency levels (50 → 100 → 200 → 300) to evaluate performance under load.


---

## 🔬 Preliminary Stress Test (Fixed 300 connections)

**Command:**
```bash
npx autocannon -c 300 -d 120 -p 10 https://avalanche-docs-eight.vercel.app/hackathons
```

- **Total Requests:** ~98,000  
- **Avg Latency:** 3,701 ms  
- **Max Latency:** 16,852 ms  
- **Req/sec Avg:** 792  
- **Throughput Avg:** ~69.5 MB/s  
- **Errors:** 110 (all timeouts)
- **Data read:** 8.34 GB 

🟡 **Interpretation:**  
This was a high-load baseline test at 300 concurrent users. The system managed to serve most requests (with 98k total), but high latency (up to 16s) and 110 timeouts suggest nearing infrastructure limits under sustained concurrency. Still, it handled a significant load volume.

---

## 🧪 Test 1: 50 Connections, 10s Duration

- **Total Requests:** 6,412
- **Avg Latency:** 755 ms
- **Max Latency:** 3,425 ms
- **Req/sec Avg:** 641
- **Throughput Avg:** ~56.3 MB/s
- **Errors:** 0
- **Data read:** 563.02 MB

✅ **Interpretation:**  
Very stable. The endpoint handles 50 concurrent users with excellent response time and no errors or slowdowns.

---

## 🧪 Test 2: 100 Connections, 10s Duration

- **Total Requests:** 8,009
- **Avg Latency:** 1,265 ms
- **Max Latency:** 4,477 ms
- **Req/sec Avg:** 728
- **Throughput Avg:** ~63.9 MB/s
- **Errors:** 0
- **Data read:** 703.25 MB

🟡 **Interpretation:**  
Still solid performance, but latency increases noticeably. The system begins to show strain under 100 concurrent connections, yet maintains stability.

---

## 🧪 Test 3: 200 Connections, 20s Duration

- **Total Requests:** 15,470
- **Avg Latency:** 2,384 ms
- **Max Latency:** 11,373 ms
- **Req/sec Avg:** 773
- **Throughput Avg:** ~67.9 MB/s
- **Errors:** 0
- **Data read:** 1.36 GB

🔶 **Interpretation:**  
Performance is acceptable, but latency is high and approaching the 10s serverless timeout limit. You're nearing the upper boundary of safe serverless operation.

---

## 🧪 Test 4: 300 Connections, 100s Duration

- **Total Requests:** 7,242
- **Avg Latency:** 5,350 ms
- **Max Latency:** 11,902 ms
- **Req/sec Avg:** 72
- **Throughput Avg:** ~1.1 MB/s
- **Errors:** 29,817 (22,580 timeouts, 7,237 5xx errors)
- **Data read:** 108.93 MB

❌ **Interpretation:**  
The system **failed under this load**. Nearly all requests timeout or result in server errors (HTTP 500). Vercel's serverless functions likely hit concurrency and execution time limits. The backend is overwhelmed.

🕵️ **Failure point:** Database transfer quota exceeded. Please consider database quota to attend real life traffic.

---

## 📊 Summary & Conclusions

| Concurrency | Status   | Notes                              |
|-------------|----------|-------------------------------------|
| 50          | ✅ Stable | Fast, no errors                     |
| 100         | ✅ OK     | Slight latency rise, no errors     |
| 200         | ⚠️ Risk  | High latency, near timeout ceiling |
| 300         | ❌ Fail   | Massive timeouts and 500 errors    |

📦 Overall Transfer Summary
Total Requests Executed: 135,133

Total Data Read: 11,075.2 MB (≈ 10.8 GB)

Average Data Read per Request: 0.082 MB (≈ 84 KB)

Approximately half of these 10 GB came from database usage, so we can assume that each time a user accesses the hackathons list, there will be a database consumption of around 40–50 kB.

🧮 Based on the 300-connection stress test and assuming ~3 requests per user, the system successfully handled the equivalent of ~2,400 active users over 100 seconds.

📈 This translates to approximately 1,400–1,500 real users per minute at peak.

⚠️ Beyond this threshold, errors and timeouts increase sharply due to backend saturation.


💡 This provides a clear estimate of the data payload per request, useful for projecting real-world database usage and bandwidth costs under expected traffic patterns

There's a run.sh file in this folder that allows to run the current test
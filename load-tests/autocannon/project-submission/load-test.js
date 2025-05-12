const autocannon = require("autocannon");
const { randomUUID } = require("crypto");

const baseUrl = "https://avalanche-docs-eight.vercel.app/";
const hackathonId = "26bfce9b-4d44-4d40-8fbe-7903e76d48f1";

function generatePayload() {
  const uuid = randomUUID().slice(0, 8);
  return {
    project_name: `Project-${uuid}`,
    short_description: "This project will become a religion.",
    full_description: "This is a description",
    tech_stack: "Built with love and inspiration",
    github_repository: `https://github.com/user-${uuid}/project`,
    explanation: "",
    demo_link: `https://demo.project-${uuid}.vercel.app`,
    is_preexisting_idea: false,
    demo_video_link: "https://www.youtube.com/watch?v=RQWpF2Gb-gU",
    tracks: ["dApps on Avalanche L1s", "AI Infra & Agents", "Custom VMs"],
    logoFile: {},
    coverFile: {},
    screenshots: [
      "https://49ci7gswyprqetfg.public.blob.vercel-storage.com/FONDO%201-1fjbqkLnzH0bxgHSbQ4ALwAx9RiKEq.png",
    ],
    isDraft: true,
    logo_url:
      "https://49ci7gswyprqetfg.public.blob.vercel-storage.com/Logo-nKoXupuTBAASf9cte94puh7gorqb6t.png",
    cover_url:
      "https://49ci7gswyprqetfg.public.blob.vercel-storage.com/4086652-fEOUYUGvivESRwb7vwDF5vudKTRh9T.png",
    hackaton_id: hackathonId,
    user_id: "cm9v1pr3u0009uhwg6dblzs8m",
    is_winner: false,
    id: randomUUID(),
  };
}

function runLoadTest(connections, duration) {
  return new Promise((resolve) => {
    const instance = autocannon({
      url: baseUrl + "api/project",
      method: "POST",
      connections,
      duration,
      setupClient: (client) => {
        const payload = JSON.stringify(generatePayload());
        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
          "Content-Length": Buffer.byteLength(payload).toString(),
          Origin: baseUrl,
          referer: `${baseUrl}hackathons/project-submission?hackathon=${hackathonId}`,
          "User-Agent": "curl/8.5.0",
          Connection: "close",
          "user-agent": "autocannon-test",
          Cookie:
            "Take a session cookie from the browser",
        };
        // console.log("Headers:", headers);
        // console.log("Body:", payload);
        client.setHeadersAndBody(headers, payload);
        // client.on("response", (status, body, context) => {
        //   try {
        //     if (Buffer.isBuffer(body)) {
        //       const text = body.toString("utf8");
        //       console.log(
        //         `✅ Response [${status}] length=${text.length}: ${text.slice(
        //           0,
        //           200
        //         )}`
        //       );
        //     } else {
        //       console.error(
        //         `⚠️ Non-buffer response [${status}] — type: ${typeof body}, value: ${JSON.stringify(
        //           body
        //         )}`
        //       );
        //     }
        //   } catch (err) {
        //     console.error("⚠️ Failed to parse response:", err);
        //   }
        // });
      },
    });

    autocannon.track(instance, {
      renderProgressBar: true,
      renderResultsTable: true,
    });

    instance.on("done", resolve);
  });
}

async function runRampUp() {
  console.log("🚀 Starting load test ramp-up sequence...\n");

  console.log("▶️ Phase 1: 50 users for 2 seconds");
  await runLoadTest(50, 2);

  console.log("\n▶️ Phase 2: 100 users for 5 seconds");
  await runLoadTest(100, 5);

  console.log("\n▶️ Phase 3: 200 users for 8 seconds");
  await runLoadTest(200, 8);

  console.log("\n▶️ Phase 4: 300 users for 10 seconds");
  await runLoadTest(300, 10);

  console.log("\n✅ Load test ramp-up completed.");
}

runRampUp();

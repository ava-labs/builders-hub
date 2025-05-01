const autocannon = require("autocannon");
const { randomUUID } = require("crypto");
const { headers } = require("next/headers");

const basePayload = {
  name: "andrea.vargas@avalabs.org",
  email: "andrea.vargas@avalabs.org",
  company_name: "Avalanche",
  telegram_user: "Avalanche",
  role: "DevRel",
  city: "Mexico",
  interests: ["defi", "blockchain"],
  web3_proficiency: "3",
  tools: ["metamask", "ethersjs"],
  roles: ["developer", "productManager"],
  languages: ["javascript", "python", "solidity", "rust", "go"],
  hackathon_participation: "yes",
  dietary: "None",
  github_portfolio: "https://github.com/sebaxor",
  terms_event_conditions: true,
  newsletter_subscription: true,
  prohibited_items: true,
  hackathon_id: "26bfce9b-4d44-4d40-8fbe-7903e76d48f1",
  utm: "",
};



function generatePayload() {
  const uuid = randomUUID().slice(0, 8);
  return {
    ...basePayload,
    name: `User ${uuid}`,  
    email:  getRandomEmail(),
    telegram_user: `user_${uuid}`,
    github_portfolio: `https://github.com/user_${uuid}`,
  };
}
function getRandomEmail() {
    const index = Math.floor(Math.random() * emails.length);
    return emails[index];
  }

const emails = [
    "anotherdev.eth@gmail.com",
    "team@voyagership.co",
    "andrea.vargas@avalabs.org",
    "samuel@insomnialabs.io",
    "yktzwzsvfgurjcxwzd@poplk.com",
    "jtcsiqqpeaxuurvfoq@ytnhy.com",
    "yhhyumvbrjbscupohz@nbmbb.com",
    "federico.nardelli7@gmail.com",
    "elmomarioneta@gmail.com",
    "sebasor@gmail.com",
    "sebastianmosquera1075@gmail.com",
    "arkhatraz777@gmail.com"
  ];

function runLoadTest(connections, duration) {
  const baseUrl = "https://avalanche-docs-eight.vercel.app/";
  return new Promise((resolve) => {
    const instance = autocannon({
      url: baseUrl + "api/register-form",
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
          Referer:
            baseUrl +
            "hackathons/registration-form?hackathon=26bfce9b-4d44-4d40-8fbe-7903e76d48f1",
          "User-Agent": "curl/8.5.0",
          Connection: "close",
        };

        client.setHeadersAndBody(headers, payload);
      
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

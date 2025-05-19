
// cron.js
const cron = require("node-cron");
const { fetchAndPublish } = require("./server");

// Schedule: daily at 7am
cron.schedule("0 7 * * *", () => fetchAndPublish());

// Schedule: weekly Monday at 8am
cron.schedule("0 8 * * 1", () => fetchAndPublish());

// Keep alive for Render background worker
setInterval(() => {}, 1000 * 60 * 60);

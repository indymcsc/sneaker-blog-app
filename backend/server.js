
const express = require("express");
const fetch = require("node-fetch");
const RSSParser = require("rss-parser");
const OpenAI = require("openai");
const cheerio = require("cheerio");
const { Shopify } = require("@shopify/shopify-api");
const cors = require("cors");
const cron = require("node-cron");

const app = express();
const parser = new RSSParser();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateBlogPost(item) {
  const prompt = `Write a 500 word, stylish blog post for Lilac Blonde's in the tone of complex.com about this sneaker article.

Title: ${item.title}
Summary: ${item.summary || "N/A"}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 750,
  });

  return {
    title: item.title,
    content: completion.choices[0].message.content,
    image: item.image || "https://via.placeholder.com/600x400?text=Sneakers"
  };
}

async function scrapeSneakerNews() {
  const response = await fetch("https://sneakernews.com/");
  const html = await response.text();
  const $ = cheerio.load(html);

  const posts = [];

  $(".post-box").each((i, el) => {
    const title = $(el).find("h2.entry-title a").text().trim();
    const link = $(el).find("h2.entry-title a").attr("href");
    const image = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");

    if (title.toLowerCase().includes("women")) {
      posts.push({ title, link, image });
    }
  });

  return posts.slice(0, 3);
}

app.get("/api/scrape-sneakernews", async (req, res) => {
  try {
    const posts = await scrapeSneakerNews();
    const rewritten = await Promise.all(posts.map(generateBlogPost));
    res.json({ posts: rewritten });
  } catch (err) {
    console.error("❌ Error in /api/scrape-sneakernews:", err);
    res.status(500).json({ error: "Failed to scrape sneakernews.com" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});


const express = require("express");
const fetch = require("node-fetch");
const RSSParser = require("rss-parser");
const OpenAI = require("openai");
const cheerio = require("cheerio");
const { Shopify } = require("@shopify/shopify-api");
const cors = require("cors");

const app = express();
const parser = new RSSParser();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

// Basic test route
app.get("/", (req, res) => {
  res.send("Sneaker Blog API is live 🚀");
});

// Sneaker News fallback endpoint (stub)
app.get("/api/fetch-sneaker-news", async (req, res) => {
  try {
    const html = await fetch("https://sneakernews.com/").then(r => r.text());
    const $ = cheerio.load(html);
    const articles = [];

    $(".post-title a").slice(0, 2).each((i, el) => {
      const title = $(el).text();
      const link = $(el).attr("href");
      articles.push({ title, link });
    });

    const rewritten = await Promise.all(
      articles.map(async (item) => {
        const prompt = `Write a short sneaker blog post in the tone of complex.com based on this title and link.

Title: ${item.title}
URL: ${item.link}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
        });

        return {
          title: item.title,
          link: item.link,
          content: completion.choices[0].message.content,
          image: "https://via.placeholder.com/600x400?text=Sneakers"
        };
      })
    );

    res.json({ posts: rewritten });
  } catch (err) {
    console.error("❌ Error in /api/fetch-sneaker-news:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔊 Render requires this
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});

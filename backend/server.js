
const express = require("express");
const fetch = require("node-fetch");
const RSSParser = require("rss-parser");
const OpenAI = require("openai");
const { Shopify } = require("@shopify/shopify-api");
const cors = require("cors");

const app = express();
const parser = new RSSParser();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper: Generate Blog Post
async function generateBlogPost(item) {
  const content = item["content:encoded"] || item.content || "";
  const imageMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);

  const prompt = `Write a short, stylish blog post in Lilac Blonde's tone about this sneaker headline and summary.

Title: ${item.title}
Summary: ${item.contentSnippet}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
  });

  return {
    title: item.title,
    content: completion.choices[0].message.content,
    image: imageMatch ? imageMatch[1] : "https://via.placeholder.com/600x400?text=Sneakers",
  };
}

// Endpoint to fetch sneaker news and return rewritten posts
app.get("/api/fetch-sneaker-news", async (req, res) => {
  try {
    const feed = await parser.parseURL("https://news.google.com/rss/search?q=women%27s+sneakers");
    const top = feed.items.slice(0, 3);
    const rewritten = await Promise.all(top.map(generateBlogPost));
    res.json({ posts: rewritten });
  } catch (err) {
    console.error("❌ Error in /api/fetch-sneaker-news:");
    console.error(err?.response?.status);
    console.error(err?.response?.data || err.message || err);
    res.status(500).json({ error: "Invalid response format" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log("==> Your service is live 🎉");
});

module.exports = {};

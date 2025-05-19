
const express = require("express");
const fetch = require("node-fetch");
const RSSParser = require("rss-parser");
const OpenAI = require("openai");
const { Shopify } = require("@shopify/shopify-api");
const cors = require("cors");
const cheerio = require("cheerio");

const app = express();
const parser = new RSSParser();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FEEDS = [
  "https://news.google.com/rss/search?q=nike+women+shoes&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=adidas+women+shoes&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=new+balance+women+shoes&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=hoka+women+shoes&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=asics+women+shoes&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=on+running+women+shoes&hl=en-US&gl=US&ceid=US:en"
];

const fallbackImages = {
  nike: "https://logo.clearbit.com/nike.com",
  adidas: "https://logo.clearbit.com/adidas.com",
  hoka: "https://logo.clearbit.com/hoka.com",
  "new balance": "https://logo.clearbit.com/newbalance.com",
  asics: "https://logo.clearbit.com/asics.com",
  on: "https://logo.clearbit.com/on-running.com"
};

function getFallbackImage(title) {
  const lower = title.toLowerCase();
  for (const brand in fallbackImages) {
    if (lower.includes(brand)) return fallbackImages[brand];
  }
  return "https://upload.wikimedia.org/wikipedia/commons/0/0b/Google_News_icon.svg";
}

async function fetchOgImage(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    const ogImage = $('meta[property="og:image"]').attr("content");
    return ogImage || null;
  } catch (err) {
    return null;
  }
}

async function generateBlogPost(item) {
  const prompt = `Write a 500 word, stylish blog post for Lilac Blonde's in the tone of complex.com about this sneaker article.

Article title: ${item.title}
Summary: ${item.contentSnippet}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 750,
  });

  const image = (await fetchOgImage(item.link)) || getFallbackImage(item.title);

  return {
    title: item.title,
    content: completion.choices[0].message.content,
    image
  };
}

app.get("/api/fetch-sneaker-news", async (req, res) => {
  try {
    const results = [];
    for (const feedURL of FEEDS) {
      const feed = await parser.parseURL(feedURL);
      const item = feed.items.find(i => i.title.toLowerCase().includes("women"));
      if (item) {
        const post = await generateBlogPost(item);
        results.push(post);
      }
    }
    res.json({ posts: results });
  } catch (err) {
    console.error("❌ Error in /api/fetch-sneaker-news:", err);
    res.status(500).json({ error: "Failed to fetch news." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});

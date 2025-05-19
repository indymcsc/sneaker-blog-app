// server.js
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
  const imageMatch = item.content.match(/<img[^>]+src="([^"]+)"/);
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

// 🔁 Exportable for cron.js
async function fetchAndPublish() {
  const feed = await parser.parseURL("https://sneakernews.com/category/womens/feed/");
  const top = feed.items.slice(0, 1);
  const item = top[0];
  const post = await generateBlogPost(item);

  const session = await Shopify.Utils.loadOfflineSession("lilacblonde.myshopify.com");
  const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

  await client.post({
    path: "blogs/79027699861/articles",
    data: {
      article: {
        title: post.title,
        body_html: `<div><img src='${post.image}' alt='Sneaker'/><p>${post.content}</p></div>`,
        tags: "sneakers, women, lilac blonde, news",
        published: true
      }
    },
    type: Shopify.Clients.Rest.DataType.JSON
  });
}

// 🛠 Manual fetch route for UI
app.get("/api/fetch-sneaker-news", async (req, res) => {
  const feed = await parser.parseURL("https://sneakernews.com/category/womens/feed/");
  const top = feed.items.slice(0, 3);

  const rewritten = await Promise.all(top.map(generateBlogPost));
  res.json({ posts: rewritten });
});

// 🛠 Manual publish route
app.post("/api/publish-blog-post", async (req, res) => {
  const { title, content, image } = req.body;
  try {
    const session = await Shopify.Utils.loadOfflineSession("lilacblonde.myshopify.com");
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

    await client.post({
      path: "blogs/79027699861/articles",
      data: {
        article: {
          title,
          body_html: `<div><img src='${image}' alt='Sneaker'/><p>${content}</p></div>`,
          tags: "sneakers, women, lilac blonde, news",
          published: true
        }
      },
      type: Shopify.Clients.Rest.DataType.JSON
    });

    res.json({ message: "Blog post published to Shopify. Now import it into Bloggle." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to publish blog post." });
  }
});

// Run server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));

// Export for cron
module.exports = { fetchAndPublish };

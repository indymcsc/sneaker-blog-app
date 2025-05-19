const express = require("express");
const fetch = require("node-fetch");
const RSSParser = require("rss-parser");
const OpenAI = require("openai");
const { Shopify } = require("@shopify/shopify-api");
const cors = require("cors");
const cron = require("node-cron");

const app = express();
const parser = new RSSParser();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FEEDS = [
  "https://sneakernews.com/category/womens/feed/",
  "https://news.google.com/rss/search?q=women%27s+sneakers&hl=en-US&gl=US&ceid=US:en",
  "https://hypebae.com/feed"
];

async function generateBlogPost(item) {
  const content = item["content:encoded"] || item.content || "";
  const imageMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  const prompt = `Write a 500 word, stylish blog post for Lilac Blonde's in the tone of complex.com about this sneaker article.

Article title: ${item.title}
Summary: ${item.contentSnippet}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 750,
  });

  return {
    title: item.title,
    content: completion.choices[0].message.content,
    image: imageMatch ? imageMatch[1] : "https://via.placeholder.com/600x400?text=Sneakers"
  };
}

async function fetchAndPublish() {
  try {
    for (const feedURL of FEEDS) {
      const feed = await parser.parseURL(feedURL);
      const item = feed.items.find(i => i.title.toLowerCase().includes("women"));
      if (!item) continue;
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
      break;
    }
  } catch (err) {
    console.error("❌ Error in fetchAndPublish:", err);
  }
}

app.get("/api/fetch-sneaker-news", async (req, res) => {
  try {
    const feed = await parser.parseURL(FEEDS[0]);
    const top = feed.items.filter(i => i.title.toLowerCase().includes("women")).slice(0, 3);
    const rewritten = await Promise.all(top.map(generateBlogPost));
    res.json({ posts: rewritten });
  } catch (err) {
    console.error("❌ Error in /api/fetch-sneaker-news:", err);
    res.status(500).json({ error: "Failed to fetch news." });
  }
});

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
    console.error("❌ Error in /api/publish-blog-post:", err);
    res.status(500).json({ error: "Failed to publish blog post." });
  }
});

cron.schedule("0 7 * * *", fetchAndPublish);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});

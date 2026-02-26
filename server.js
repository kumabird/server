const express = require("express");
const fetch = require("node-fetch");
const { URL } = require("url");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/proxy", async (req, res) => {
    const target = req.query.url;
    if (!target) return res.status(400).send("URL parameter missing");

    try {
        const response = await fetch(target, {
            headers: {
                "User-Agent": "Mozilla/5.0",
            }
        });

        let contentType = response.headers.get("content-type") || "";
        let body = await response.buffer();

        // iframeブロックを解除
        res.removeHeader("X-Frame-Options");
        res.removeHeader("Content-Security-Policy");

        res.setHeader("Access-Control-Allow-Origin", "*");

        if (contentType.includes("text/html")) {
            let html = body.toString();

            const baseUrl = new URL(target);

            // 相対パスを絶対パスへ変換
            html = html.replace(/(src|href)=["'](.*?)["']/gi, (match, attr, url) => {
                try {
                    const absolute = new URL(url, baseUrl).href;
                    return `${attr}="/proxy?url=${encodeURIComponent(absolute)}"`;
                } catch {
                    return match;
                }
            });

            res.setHeader("Content-Type", "text/html");
            return res.send(html);
        }

        res.setHeader("Content-Type", contentType);
        res.send(body);

    } catch (err) {
        res.status(500).send("Fetch error: " + err.message);
    }
});

app.listen(PORT, () => {
    console.log("Proxy running on http://localhost:" + PORT);
});

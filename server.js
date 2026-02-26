const express = require("express");
const fetch = require("node-fetch");
const { URL } = require("url");
const tough = require("tough-cookie");
const fetchCookie = require("fetch-cookie");

const app = express();
const PORT = 3000;

const cookieJar = new tough.CookieJar();
const fetchWithCookies = fetchCookie(fetch, cookieJar);

app.use(express.json({limit:"50mb"}));
app.use(express.urlencoded({extended:true,limit:"50mb"}));

app.all("/proxy", async (req, res) => {
    const target = req.query.url;
    if (!target) return res.status(400).send("URL parameter missing");

    try {
        const response = await fetchWithCookies(target, {
            method: req.method,
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Referer": target,
                "Origin": new URL(target).origin,
                ...req.headers
            },
            body: ["GET","HEAD"].includes(req.method) ? undefined : req.body,
            redirect: "follow"
        });

        let contentType = response.headers.get("content-type") || "";
        let buffer = await response.buffer();

        // iframe制限除去
        res.removeHeader("X-Frame-Options");
        res.removeHeader("Content-Security-Policy");

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "*");

        if (contentType.includes("text/html")) {
            let html = buffer.toString();
            const baseUrl = new URL(target);

            html = html.replace(/(src|href|action)=["'](.*?)["']/gi, (match, attr, url) => {
                try {
                    const absolute = new URL(url, baseUrl).href;
                    return `${attr}="/proxy?url=${encodeURIComponent(absolute)}"`;
                } catch {
                    return match;
                }
            });

            // JSのfetchも強制プロキシ
            html = html.replace(/fetch\(["'](.*?)["']/g, (match, url) => {
                try {
                    const absolute = new URL(url, baseUrl).href;
                    return `fetch("/proxy?url=${encodeURIComponent(absolute)}"`;
                } catch {
                    return match;
                }
            });

            res.setHeader("Content-Type", "text/html");
            return res.send(html);
        }

        res.setHeader("Content-Type", contentType);
        res.send(buffer);

    } catch (err) {
        res.status(500).send("Fetch error: " + err.message);
    }
});

app.listen(PORT, () => {
    console.log("🔥 Advanced Proxy running on http://localhost:" + PORT);
});

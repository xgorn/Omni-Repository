# 🪐 Omni Repository

Omni Repository is a sleek, unified, self-hosted progress archive built to keep a digital log of your reading and viewing journeys across **Novels, Manga, Manhwa, Manhua, and Anime**. Anyone can view your reading registry, but administrative modifications (adding series, editing tag aliases, adjusting chapters) are locked behind a secure API token gate.

The repository includes a **Next.js Core Dashboard UI** hosted in the cloud alongside an automated background **Tampermonkey cross-origin userscript** that syncs your progress straight to MongoDB the second you turn a page on popular web reading platforms.

---

## 🚀 Server Architecture & Deployment (Vercel)

Omni Repository uses the Next.js App Router framework. It stores data on a secure cluster and validates authorization tokens entirely on the server side to protect your credentials.

### 1. Prerequisites & Environment Variables
Before launching your server instances on Vercel, prepare your private tokens. Create a local `.env.local` file for staging, and register these keys inside your production platform:

```text
# MongoDB Cluster connection link string
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/Omni_db

# Private Master authorization key used to block unauthorized database modifications
API_SECRET_KEY=MySecretNovelToken2026!
```

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fxgorn%2FOmni-Repository&env=MONGODB_URI,API_SECRET_KEY&envDefaults=%7B%22MONGODB_URI%22%3A%22mongodb%2Bsrv%3A%2F%2F%3Cusername%3E%3A%3Cpassword%3E%40cluster0.xxxx.mongodb.net%2FOmni_db%22%2C%22API_SECRET_KEY%22%3A%22YourSecretNovelToken2026!%22%7D&project-name=Omni-Repository)

### 2. Standard Deployment Lifecycle Steps
Push your completed Next.js project code to a private or public GitHub repository.

Log into your Vercel Dashboard account, click Add New, and select Project.

Import your repository from the Git integrations menu list.

Expand the Environment Variables configuration tab dropdown block.

Key-in your values for MONGODB_URI and API_SECRET_KEY.

Click Deploy. Vercel will build your serverless backend pipeline automatically in less than 60 seconds!

## 📜 Client Automation (Tampermonkey Userscript)
The automation engine sits silently in your browser background. Whenever you load a valid novel chapter URL, it queries your cloud database to see if the book is tracked, confirms your current position, and fires a secure background update.

## 🛠️ Script Installation
Install the Tampermonkey Browser Extension for your browser.

Open your Tampermonkey Dashboard utility, navigate to the Utilities tab, and select Add a new script.

Erase any default boilerplate text template and paste the following tracking script code:

```JavaScript
// ==UserScript==
// @name         Omni Repository Multi-Media Tracker (Authenticated)
// @namespace    https://xgorn.com/
// @author       Noid
// @version      0.0.1
// @description  Automatically update reading progress or create new records using secure API Key authorization.
// @match        https://novelfire.net/book/*/chapter-*
// @match        https://lightnovelpub.org/novel/*/chapter/*/
// @grant        GM_xmlhttpRequest
// @connect      your-vercel-endpoint.vercel.app
// ==/UserScript==

(async function () {
    'use strict';

    // 🔒 Core Security Config
    const API = "https://your-vercel-endpoint.vercel.app/api"; // YOUR API ENDPOINT HERE
    const API_KEY = "yourapikey"; // 👈 PLACE YOUR KEY HERE

    /**
     * Helper to make cross-domain network requests bypassing browser CORS boundaries
     */
    function request(method, url, data = null) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method,
                url,
                headers: {
                    "Accept": "application/json",
                    "X-API-KEY": API_KEY, // 👈 Injects authentication wrapper to all methods
                    ...(data && { "Content-Type": "application/json" })
                },
                data: data ? JSON.stringify(data) : null,
                onload(response) {
                    try {
                        resolve({
                            status: response.status,
                            data: response.responseText ? JSON.parse(response.responseText) : null
                        });
                    } catch (e) {
                        resolve({
                            status: response.status,
                            data: response.responseText
                        });
                    }
                },
                onerror(error) {
                    console.error("[Tracker] Network operational error:", error);
                    reject(error);
                }
            });
        });
    }

    /**
     * Looks up if the media already exists using the authenticated filter parameter routes
     */
    async function searchLibrary(title) {
        console.log(`[Tracker] Verifying archive status for: "${title}"`);
        const res = await request("GET", `${API}/media?search=${encodeURIComponent(title)}`);

        if (res.status === 200 && Array.isArray(res.data)) {
            return res.data.find(item =>
                item.title.toLowerCase() === title.toLowerCase() ||
                item.alternative_titles?.some(alt => alt.toLowerCase() === title.toLowerCase())
            );
        }
        return null;
    }

    /**
     * Sends an authorized POST request to register a brand-new entity matching your ordered DB structure
     */
    async function addNewMediaEntry(title, chapterNumber, mediaType) {
        console.log(`[Tracker] Target not found. Auto-generating entry as type: [${mediaType}]...`);
        const res = await request("POST", `${API}/media`, {
            title: title,
            alternative_titles: [],
            last_read_chapter: chapterNumber,
            type: mediaType // Sends verified type constraint ('novel', 'manga', etc.)
        });

        if (res.status === 201) {
            console.log(`[Tracker] 🚀 Successfully added "${title}" to your cloud index!`);
            return true;
        } else {
            console.error(`[Tracker] Insertion rejected. Status code: ${res.status}`, res.data);
            return false;
        }
    }

    /**
     * Sends an authorized PATCH packet to increment progress integers matching original records
     */
    async function updateLastReadChapter(originalTitle, chapterNumber) {
        console.log(`[Tracker] Syncing progress values forward to Chapter/Episode ${chapterNumber}...`);
        const res = await request("PATCH", `${API}/media`, {
            original_title: originalTitle,
            last_read_chapter: chapterNumber
        });

        if (res.status === 200) {
            console.log(`[Tracker] Successfully locked progress for "${originalTitle}"!`);
            return true;
        } else {
            console.error(`[Tracker] Modification cycle rejected. Status code: ${res.status}`, res.data);
            return false;
        }
    }

    /**
     * Core Lifecycle Tracking orchestrator pipeline
     */
    async function trackProgress(mediaTitle, currentChapter, mediaType) {
        if (!mediaTitle || currentChapter === null) return;

        // Step 1: Search backend with key header automatically injected
        const trackedMedia = await searchLibrary(mediaTitle);

        // Step 2: Auto-Add module fallback if document verification returns empty
        if (!trackedMedia) {
            await addNewMediaEntry(mediaTitle, currentChapter, mediaType);
            return;
        }

        // Step 3: Prevent backward progress rewrites if navigating historic chapters
        if (trackedMedia.last_read_chapter >= currentChapter) {
            console.log(`[Tracker] Page cursor index (${currentChapter}) trailing backend baseline (${trackedMedia.last_read_chapter}). Update suspended.`);
            return;
        }

        // Step 4: Fire authorized progress increment payload
        await updateLastReadChapter(trackedMedia.title, currentChapter);
    }

    ///////////////// PARSERS FOR TARGET HOST MANIFESTS /////////////////

    const siteParsers = [
        {
            name: "novelfire",
            type: "novel",
            match: () => location.hostname.includes("novelfire.net"),
            getChapter() {
                const match = location.pathname.match(/chapter-(\d+)/);
                return match ? Number(match[1]) : null;
            },
            getTitle() {
                const el = document.querySelector("h1 a[title]");
                return el ? el.title.trim() : null;
            }
        },
        {
            name: "lightnovelpub.org",
            type: "novel",
            match: () => location.hostname.includes("lightnovelpub.org"),
            getChapter() {
                const match = location.pathname.match(/chapter\/(\d+)/);
                return match ? Number(match[1]) : null;
            },
            getTitle() {
                const el = document.querySelector(".novel-title");
                return el ? el.textContent.trim() : null;
            }
        }
    ];

    ///////////////// INITIALIZATION EXECUTION /////////////////

    const parser = siteParsers.find(site => site.match());

    if (parser) {
        const activeMedia = {
            title: parser.getTitle(),
            chapter: parser.getChapter(),
            type: parser.type
        };

        console.log("[Tracker] Crawler successfully bound context data:", activeMedia);

        if (activeMedia.title && activeMedia.chapter !== null) {
            await trackProgress(activeMedia.title, activeMedia.chapter, activeMedia.type);
        }
    }

})();
```
Crucial Edit Step: Modify line 16 (const API) to point to your live, custom Vercel backend domain name. Ensure line 17 matches your secret token passcode key string exactly.

Also Replace The @connect endpoint to your api endpoint.

Click File -> Save inside the Tampermonkey editor panel.

## 🎨 User Interface Privileges & Security Layout
Public Access View (Default): Visitors can browse your dashboard index entries natively, view metrics analytics columns, and run searches. No buttons, update icons, or administrative components will render or clog up the layout interfaces.

Administrator Dashboard Session (Token Gate): Enter your private authorization key parameter into the console login input inside the navigation header block to unlock modification functions. Privileges include dynamic pill tag updates, chapter increment hooks, and database replacement edits.
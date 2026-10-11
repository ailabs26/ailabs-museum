---
name: crawl4ai
description: High-performance, open-source asynchronous web crawler and scraper tailored for LLMs and AI agents. Converts websites into clean Markdown, extracts structured data, and runs locally with Playwright without cloud API costs.
metadata:
  origin: community
---

# crawl4ai — Open-Source LLM Web Crawler & Scraper

`crawl4ai` is a local-first, asynchronous web crawling and scraping engine designed specifically for LLMs and AI agents. It extracts clean, token-efficient Markdown, handles complex JavaScript rendering via Playwright, and extracts structured data without relying on paid cloud APIs.

---

## When to Use

- **Local & Free Scraping**: Extracting deep website content or documentation without paying for third-party cloud scraping APIs (e.g. Firecrawl, Apify).
- **LLM-Optimized Markdown**: Transforming cluttered HTML pages into structured, noise-free Markdown (stripping navbars, ads, scripts, footer noise).
- **Structured Data Extraction**: Extracting product lists, articles, tables, or documentation hierarchies using CSS/XPath or schema extraction.
- **Dynamic JavaScript Sites**: Crawling Single Page Applications (Angular, React, Vue) where content loads asynchronously via client-side fetch.

### When NOT to Use
- **Simple Static Webpages**: Use built-in HTTP GET (`read_url_content`) for speed and minimal overhead.
- **Direct Browser Visual QA / Human Emulation**: Use `browser-use` or `browser-qa` when testing UI clicks, drag-and-drop, or multi-step auth sessions.

---

## Setup & Installation

`crawl4ai` runs as a Python package leveraging Playwright under the hood:

```bash
# 1. Install crawl4ai
pip install crawl4ai

# 2. Run post-installation to install required browser binaries
crawl4ai-setup

# 3. Verify installation
python -c "import crawl4ai; print(crawl4ai.__version__)"
```

On Windows, ensure PowerShell allows process execution and Python is on your `PATH`.

---

## Core Agent Workflows & Patterns

### 1. Basic Fast Markdown Extraction (Scratch Script)
To scrape a page and get LLM-ready markdown, generate and execute a scratch script:

```python
import asyncio
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig

async def scrape_to_markdown(url: str):
    browser_cfg = BrowserConfig(headless=True, verbose=False)
    run_cfg = CrawlerRunConfig(
        word_count_threshold=10,
        remove_overlay_elements=True,
        exclude_external_links=True
    )
    
    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        result = await crawler.arun(url=url, config=run_cfg)
        if result.success:
            print("=== EXTRACTED MARKDOWN ===")
            print(result.markdown)
            return result.markdown
        else:
            print(f"Scrape failed: {result.error_message}")
            return None

if __name__ == "__main__":
    asyncio.run(scrape_to_markdown("https://example.com/docs"))
```

### 2. Targeting Specific Selectors (Noise Reduction)
Avoid wasting LLM context window by scoping down to the article/content container:

```python
run_cfg = CrawlerRunConfig(
    css_selector="main, article, .documentation-content, #content",
    remove_forms=True,
    ignore_canonical=False
)
```

### 3. Handling Infinite Scroll & Lazy Loading
For content-heavy feeds or API documentation that loads on scroll:

```python
run_cfg = CrawlerRunConfig(
    js_code="window.scrollTo(0, document.body.scrollHeight);",
    wait_for="article.item:nth-child(5)",
    delay_before_return_html=2.0
)
```

### 4. Structured JSON Extraction (CSS-based Strategy)
Extract clean tables, catalogues, or listings into JSON:

```python
from crawl4ai.extraction_strategy import JsonCssExtractionStrategy
import json

schema = {
    "name": "Documentation Index",
    "baseSelector": "nav.toc-tree li",
    "fields": [
        {"name": "title", "selector": "a", "type": "text"},
        {"name": "link", "selector": "a", "type": "attribute", "attribute": "href"}
    ]
}

run_cfg = CrawlerRunConfig(
    extraction_strategy=JsonCssExtractionStrategy(schema)
)
```

---

## Best Practices for AI Agents

1. **Save to Scratch**: When running `crawl4ai` in agent tasks, write the Python script to `<appDataDir>\scratch\scrape_target.py` and run it via `run_command`.
2. **Token Economy**: Always prefer `result.fit_markdown` or scoped `css_selector` over raw HTML to keep the agent's context window clean.
3. **Windows Async Policy**: In Windows Python scripts, ensure `asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())` is used if event loop issues occur with sub-processes.
4. **Caching**: Store downloaded docs in `.cache/crawl/` or scratch files to prevent re-crawling identical URLs across agent turns.

# mcp-yelp

Yelp MCP — wraps the Yelp Fusion API (api.yelp.com/v3)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_businesses` | Search for local businesses and restaurants on Yelp by term and location. Returns matching businesses with star ratings, review counts, price, categories, address, and phone. Example: search_businesses({ term: "pizza", location: "San Francisco, CA" }). |
| `get_business` | Get full details for a single Yelp business by its id or alias. Returns rating, review count, price, categories, address, phone, hours, photos, and coordinates. Example: get_business({ id: "garaje-san-francisco" }). |
| `get_reviews` | ⚠️ UPSTREAM-UNRELIABLE — Yelp Fusion's /reviews endpoint has been 404-ing on most ids since mid-2026 even for valid businesses. PREFER `get_business` (which sometimes inlines a snippet) or `search_businesses` for review-context queries. If you must call get_reviews: pass the ENCRYPTED business id (long alphanumeric, e.g. "WavvLdfdP6g8aZTtbBQHTw") returned in search_businesses results — aliases / slugs (e.g. "garaje-san-francisco") reliably 404. Returns up to 3 review snippets per business (rating, text, author, timestamp); "limit" is capped by Yelp upstream regardless of what you pass. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "yelp": {
      "url": "https://gateway.pipeworx.io/yelp/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Yelp data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT

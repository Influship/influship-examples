# Creator research example

A local Node.js 22+ app for Instagram creator search, match evidence, and saved shortlists. No dependency installation is required.

```bash
export INFLUSHIP_API_KEY="your_api_key_here"
node server.mjs
```

Open http://127.0.0.1:3344. Set `PORT` to use another local port.

Search returns up to five creators and costs up to $0.35 with API-key billing. Saving and reopening lists costs no credits. New API customers receive 500 starter credits.

1. Enter a brief and click **Find creators**.
2. Review reasons and expand **Review supporting evidence**.
3. Select 1–8 Instagram profiles, add a list name and notes, then save.
4. Click **Load lists** and reopen your saved selection.

Reopened lists contain profile references, brief, and notes. Saving an edited selection creates a new list. This example does not update or delete existing lists. If a save fails after reaching the API, load your lists before retrying to check whether it completed. Searches and saves are never automatically retried.

`server.mjs` holds the API key and forwards only search and shortlist requests. `app.js` renders responses with DOM text nodes. `styles.css` provides the responsive layout. The server binds to loopback and checks local request origins.

To deploy this interface, add your application's user authentication, authorize access to account-owned lists, and enforce per-user request and spending limits. Keep the API key on the server. This local example shares the lists belonging to the configured API account.

Full guide: https://docs.influship.com/cookbook/creator-research-app

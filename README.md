# Black Buffalo Games

A dark buffalo-themed browser game site launching with Blackjack and structured for more games later.

## Local Development

```bash
npm install
npm run dev
```

The dev server uses `http://127.0.0.1:5175` so it does not collide with other local Vite projects.

## Checks

```bash
npm test
npm run build
```

## Cloudflare Pages

Recommended project settings:

- Framework preset: React / Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: leave blank unless this app is moved into a monorepo subfolder

The `public/_redirects` file is included so direct SPA links like `/games/blackjack` resolve to the app.

## Deploy

1. Push this repository to GitHub or another Git provider connected to Cloudflare.
2. In Cloudflare, go to Workers & Pages.
3. Choose Create application > Pages > Import an existing Git repository.
4. Select this repository.
5. Use the build settings above, then choose Save and Deploy.

Cloudflare will deploy the app to a `*.pages.dev` URL and rebuild it whenever you push new commits.

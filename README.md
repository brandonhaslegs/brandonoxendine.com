# brandonoxendine.com

## Editing text in the browser

```
npm run edit
```

Open http://localhost:4000, press **E** (or the Edit button), click any
paragraph, heading, caption or list item and type. Enter or clicking away
saves it straight into that page's HTML file; Escape undoes the block. Review
with `git diff` and commit as usual.

## Share images

```
npm run share
```

Makes a 1200×630 share card for every page in `images/share/` from the
page's lead image (or a pink title card when it has none), and writes the
Open Graph / Twitter tags between `<!-- share -->` markers in its `<head>`.
Run it again after adding a page or changing a page's first image; pass
file paths to do just those pages. Needs Google Chrome and `npm install`.

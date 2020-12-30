# LetsPack

A minimal tool for bundling and minifing scripts and styles.

## Usage

```javascript
const { LetsPack } = require("letspack");
const letsPack = new LetsPack();

letsPack
  .scripts("./src/scripts/", "./dist/app.min.js")
  .styles("./src/styles/site.css", "./dist/app.min.css")
  .version();
```

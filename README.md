# Javascript
My JS Playground


Nothing fancy, just my playground for trying new libraries and code


Minesweeper using p5js: https://bashmohandes.github.io/Javascript/index.html

PONG using p5js: https://bashmohandes.github.io/Javascript/pong/index.html

Sudoku: https://bashmohandes.github.io/Javascript/Sudoku/index.html

It is also a playground for me solving some leetCode problems in JavaScript.

## Preview a pull request before merging

The repository includes a GitHub Codespaces configuration so a branch or pull
request can be tried in a real browser without publishing it to the production
GitHub Pages site:

1. Open the pull request on GitHub.
2. Select **Code**, then **Codespaces**, then **Create codespace on this branch**.
3. Wait for the forwarded **Game preview** port to open.
4. Add `/Sudoku/` to the preview URL if the repository home page is displayed.

The Codespace starts a static server on port 8000 automatically. For a local
preview, run the same server from the repository root:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000/Sudoku/>.

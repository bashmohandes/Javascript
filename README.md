# JavaScript Playground

A small collection of browser games and coding exercises, built for fun and
learning. Everything runs directly in the browser—no application build step is
required.

## Games

| Game | About | Play |
| --- | --- | --- |
| **Sudoku** | The refreshed, responsive version with notes, hints, keyboard controls, and an animated backtracking solver. | [Play modern Sudoku](https://bashmohandes.github.io/Javascript/Sudoku/) |
| **Sudoku Classic** | The original p5.js experiment, preserved alongside the new game. | [Play Sudoku Classic](https://bashmohandes.github.io/Javascript/Sudoku/classic/) |
| **Minesweeper** | A canvas-based take on the classic mine-clearing puzzle. | [Play Minesweeper](https://bashmohandes.github.io/Javascript/Minesweeper/) |
| **Pong** | A small p5.js implementation of Pong. | [Play Pong](https://bashmohandes.github.io/Javascript/pong/) |

The repository also contains solutions and experiments from LeetCode,
Codeforces, and Codewars.

## Preview changes before merging

### GitHub Codespaces

The included development container makes it possible to try a branch or pull
request without publishing it to the production GitHub Pages site:

1. Open the pull request on GitHub.
2. Select **Code → Codespaces → Create codespace on this branch**.
3. Wait for the forwarded **Game preview** port to open.
4. Open `/Sudoku/` for the new game or `/Sudoku/classic/` for the original.

### Local preview

From the repository root, start a static server:

```sh
python3 -m http.server 8000
```

Then open one of these URLs:

- Modern Sudoku: <http://localhost:8000/Sudoku/>
- Classic Sudoku: <http://localhost:8000/Sudoku/classic/>

## Sudoku controls

- Select a square and use the on-screen number pad or keyboard keys `1`–`9`.
- Press `N` to toggle notes and use arrow keys to move around the board.
- Use **Hint** for a nudge or **Auto solve** to watch the backtracking solver.
- During auto-solve, select **Stop solve** to return to your board.

## License

See [LICENSE](LICENSE).

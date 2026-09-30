# 2048

A polished, dependency-free implementation of the classic **2048** puzzle game, built with plain HTML, CSS, and JavaScript.

Slide the tiles, merge matching numbers, and try to reach **2048**, then keep going if you like.

## Features

- **Smooth animations**: tiles slide, pop on merge, and fade in when spawned
- **Multiple controls**: keyboard, touch swipe, and mouse drag
- **Undo**: take back your last move
- **Best score**: saved in your browser via `localStorage`
- **Light and dark themes**: your choice is remembered
- **Win and Game Over screens**, with a "Keep Going" option after reaching 2048
- **Responsive**: works on phones, tablets, and desktops, with safe-area support for notched devices
- **Accessible**: ARIA labels, focus styles, and `prefers-reduced-motion` support
- **No dependencies, no build step**

## Controls

| Input | Action |
|-------|--------|
| Arrow keys | Move tiles |
| `W` `A` `S` `D` | Move tiles |
| `H` `J` `K` `L` | Move tiles (Vim-style) |
| Swipe (touch) | Move tiles |
| Click and drag (mouse) | Move tiles |

## How to Play

1. Move the tiles in any direction. All tiles slide as far as they can.
2. When two tiles with the same number collide, they merge into one with double the value.
3. A new tile (2 or 4) appears after every valid move.
4. Reach the **2048** tile to win. The game ends when no moves are left.

## Getting Started

No installation required.

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

Then open `index.html` in your browser. To serve it locally instead:

```bash
# Python
python -m http.server 8000

# or Node
npx serve
```

Then visit `http://localhost:8000`.

## Project Structure

```
.
├── index.html   # Page structure
├── styles.css   # Themes, layout, animations, responsive rules
└── script.js    # Game logic, input handling, storage
```

## Deploying to GitHub Pages

1. Push the files to your repository.
2. Go to **Settings → Pages**.
3. Under **Source**, choose your main branch and the `/ (root)` folder.
4. Save. Your game will be live at `https://<your-username>.github.io/<your-repo>/`.

## Tech Notes

- Tiles are absolutely positioned and moved with CSS `transform`, so animations stay smooth.
- Each move runs in two phases: tiles slide first, then merges, the new tile, and the win/lose check are applied.
- Undo stores a snapshot taken *before* each valid move. Moves that change nothing don't overwrite it.
- Each tile can merge only once per move.
- Fonts: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) via Google Fonts.

## Credits

Created with ❤️ and ☕ by **Hossein Seyed Bagheri**.

Inspired by the original [2048](https://github.com/gabrielecirulli/2048) by Gabriele Cirulli.

## License

[MIT]([https://choosealicense.com/licenses/mit/](https://github.com/hosseinb1111/Implement-2048/blob/main/LICENSE)).

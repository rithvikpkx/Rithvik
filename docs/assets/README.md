# README assets

Media referenced by the project root `README.md`.

Files:

- `demo.mp4` — full-length screen recording of the site (linked from the Demo section)
- `demo.webp` — 60-second animated preview that autoplays in the README; generated from `demo.mp4`

Regenerate the preview after replacing `demo.mp4`:

```
ffmpeg -y -t 60 -i demo.mp4 -vf "fps=12,scale=900:-1:flags=lanczos" \
  -c:v libwebp -loop 0 -q:v 55 -compression_level 6 demo.webp
```

Keep files reasonably small so the repo stays light — compress recordings before committing.

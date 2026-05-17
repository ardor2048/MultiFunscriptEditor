# Multi Funscript Editor

Multi Funscript Editor is a browser-based editor for standard `.funscript` files and the custom `multiAction` extension used by multi-action device controllers.

## Features

- Load local video files in the browser.
- Load and export `.funscript` JSON files.
- Edit standard `actions` points with `at` and `pos`.
- Edit `multiAction.timeline` commands with `SS/ZD/JX/XZ/JR/DT/PS/YL/empty`.
- Record action points with a large mouse/touch input pad.
- Stamp quick values at `0/25/50/75/100`.
- Convert standard `actions` to `multiAction` using `SS`.
- Convert `multiAction.SS` back to standard `actions`.
- Undo and redo editing operations.
- Warn before leaving with unsaved changes.
- Validate time ordering, duplicate points, `pos`, `qty`, and unknown commands.
- Deploy as a static Docker image with Nginx.

## Supported File Shape

```json
{
  "version": "1.0",
  "inverted": false,
  "range": 100,
  "actions": [
    { "at": 0, "pos": 0 }
  ],
  "metadata": {},
  "multiAction": {
    "version": "2.0",
    "timeline": [
      {
        "at": 0,
        "commands": [
          { "action": "empty", "qty": "0" }
        ]
      }
    ]
  }
}
```

## Local Run

```bash
npm run dev
```

Then open:

```text
http://localhost:5173
```

The app is dependency-free for the MVP, so `npm install` is not required.

## Shortcuts

- `Space`: play or pause the video.
- `1`-`9`: stamp values `10`-`90` at the current video time.
- `0`: stamp value `100` at the current video time.
- `Delete` / `Backspace`: delete the selected time point.
- `Ctrl+Z` / `Cmd+Z`: undo.
- `Ctrl+Y` / `Cmd+Shift+Z`: redo.

## Quick Recording

Use the quick recording panel to add points while the video plays:

1. Choose the target track, such as `actions pos`, `SS`, or `ZD`.
2. Click or drag on the recording pad. Higher positions create higher values.
3. Toggle recording on to keep writing points while the pointer moves.
4. Use the interval field to control how frequently points are sampled.

When targeting `actions pos`, the editor also writes a matching `SS` command. When targeting `SS`, it also updates the standard `actions` fallback.

## Video Compatibility

The editor uses the browser's native `<video>` element. If the diagnostic line shows `size=0x0` while the video is playing, the browser did not decode any video frames. This is usually a codec issue rather than an editor layout issue.

Recommended test format:

```text
MP4 container + H.264 video + AAC audio
```

Common black-screen cases:

- H.265 / HEVC video in a Chromium-based browser without HEVC support.
- MKV files with codecs unsupported by the browser.
- Audio-only files or damaged video tracks.

Workarounds:

- Open the editor in a browser that supports the video's codec.
- Convert the video to H.264/AAC MP4 before editing.

## Docker

Build:

```bash
docker build -t multi-funscript-editor .
```

Run:

```bash
docker run --rm -p 8080:80 multi-funscript-editor
```

Open:

```text
http://localhost:8080
```

## Validation

To validate the provided sample file:

```bash
npm run validate
```

By default the script checks:

```text
/Users/mgm/Downloads/wlwpalyer/10min-sample.funscript
```

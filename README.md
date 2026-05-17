# Multi Funscript Editor

Multi Funscript Editor is a browser-based editor for standard `.funscript` files and the custom `multiAction` extension used by multi-action device controllers.

## Features

- Load local video files in the browser.
- Load and export `.funscript` JSON files.
- Edit standard `actions` points with `at` and `pos`.
- Edit `multiAction.timeline` commands with `SS/ZD/JX/XZ/JR/DT/PS/YL/empty`.
- Convert standard `actions` to `multiAction` using `SS`.
- Convert `multiAction.SS` back to standard `actions`.
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


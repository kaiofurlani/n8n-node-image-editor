# n8n-nodes-image-cutter

Community node for **n8n** that slices or crops images using binary data only.

## Features

- Slice images horizontally or vertically into equal parts
- Crop images using fixed dimensions and optional positioning
- Works with PNG, JPEG/JPG, and WebP
- Returns multiple output items for slices and a single item for crops

## Installation

```bash
npm install -g n8n-nodes-image-cutter
```

## Node: Image Cutter & Cropper

### General Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| Binary Property | string | `data` | Binary input field |
| Operation Mode | options | `slice` | `slice` or `crop` |
| Direction | options | `horizontal` | `horizontal` or `vertical` |
| Output Format | options | `png` | `png`, `jpg`, or `webp` |
| File Name Prefix | string | `image_` | Prefix for output filenames |
| Start Index | number | `1` | Starting index for output filenames |

### Slice Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| Number of Slices | number | `4` | Total slices to create |
| Slice Width | number | `0` | Fixed width (0 = auto) |
| Slice Height | number | `0` | Fixed height (0 = auto) |
| Allow Remainder | boolean | `false` | Allow leftover pixels |

### Crop Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| Crop Width | number | — | Width of the crop |
| Crop Height | number | — | Height of the crop |
| Crop X | number | `-1` | X position (use -1 for automatic) |
| Crop Y | number | `-1` | Y position (use -1 for automatic) |
| Anchor | options | `center` | `center`, `top`, `bottom`, `left`, `right` |

## Output

Each output item contains:

- `binary.image` with the processed image
- `json` metadata: `index`, `width`, `height`, and `operation`

## License

MIT

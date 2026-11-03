// PSD (Photoshop) export.
// Rasterizes SVG layers to image data and assembles a layered .psd file.
// Depends on: exportPNGSVGString, panelWidthMM, PANEL_HEIGHT_MM (core.js),
//             safeProjectFileName, downloadBlobFile (exportHelpers.js).
// Public API: exportPSD(state, opts).

async function rasterizeSVGToImageData(svg, widthMM, heightMM, dpi = 300) {
  const pxPerMM = Math.max(1, dpi) / 25.4;
  const pixelWidth = Math.max(1, Math.round(widthMM * pxPerMM));
  const pixelHeight = Math.max(1, Math.round(heightMM * pxPerMM));
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) throw new Error("Canvas 2D context unavailable");
          ctx.clearRect(0, 0, pixelWidth, pixelHeight);
          ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
          resolve(ctx.getImageData(0, 0, pixelWidth, pixelHeight));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Could not rasterize SVG for PSD"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
function psdPushU16BE(out, v) {
  out.push((v >>> 8) & 255, v & 255);
}
function psdPushI16BE(out, v) {
  psdPushU16BE(out, v < 0 ? 0x10000 + v : v);
}
function psdPushU32BE(out, v) {
  out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
}
function psdPushAscii(out, s) {
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 255);
}
function psdPushBytes(out, b) {
  for (const x of b) out.push(x & 255);
}
function psdPascalName(name) {
  const enc = new TextEncoder();
  const raw = enc.encode(String(name || "Layer").slice(0, 255));
  const out = [Math.min(255, raw.length)];
  for (let i = 0; i < Math.min(255, raw.length); i++) out.push(raw[i]);
  while (out.length % 4 !== 0) out.push(0);
  return out;
}
function psdChannelBytes(image, channel) {
  const src = image.data;
  const len = image.width * image.height;
  const out = new Uint8Array(len);
  for (let i = 0, j = channel; i < len; i++, j += 4) out[i] = src[j];
  return out;
}
function makeLayeredPSD(layers, composite) {
  const width = composite.width;
  const height = composite.height;
  const pixelCount = width * height;
  if (width > 30000 || height > 30000)
    throw new Error(
      "PSD maximum dimension is 30000 px. Lower DPI and try again.",
    );
  const header = [];
  psdPushAscii(header, "8BPS");
  psdPushU16BE(header, 1);
  header.push(0, 0, 0, 0, 0, 0);
  psdPushU16BE(header, 4);
  psdPushU32BE(header, height);
  psdPushU32BE(header, width);
  psdPushU16BE(header, 8);
  psdPushU16BE(header, 3);
  const colorModeData = [0, 0, 0, 0];
  const imageResources = [0, 0, 0, 0];
  const layerRecords = [];
  const layerPixelData = [];
  const channelIds = [0, 1, 2, -1];
  for (const layer of layers) {
    const img = layer.data;
    if (img.width !== width || img.height !== height)
      throw new Error("PSD layers have mismatched raster sizes.");
    psdPushU32BE(layerRecords, 0);
    psdPushU32BE(layerRecords, 0);
    psdPushU32BE(layerRecords, height);
    psdPushU32BE(layerRecords, width);
    psdPushU16BE(layerRecords, 4);
    for (const id of channelIds) {
      psdPushI16BE(layerRecords, id);
      psdPushU32BE(layerRecords, 2 + pixelCount);
    }
    psdPushAscii(layerRecords, "8BIM");
    psdPushAscii(layerRecords, "norm");
    layerRecords.push(Math.max(0, Math.min(255, layer.opacity ?? 255)));
    layerRecords.push(0);
    layerRecords.push(8);
    layerRecords.push(0);
    const extra = [];
    psdPushU32BE(extra, 0);
    psdPushU32BE(extra, 0);
    psdPushBytes(extra, psdPascalName(layer.name));
    psdPushU32BE(layerRecords, extra.length);
    psdPushBytes(layerRecords, extra);
    for (const channel of [0, 1, 2, 3]) {
      psdPushU16BE(layerPixelData, 0);
      psdPushBytes(layerPixelData, psdChannelBytes(img, channel));
    }
  }
  const layerInfo = [];
  psdPushI16BE(layerInfo, Math.min(32767, layers.length));
  psdPushBytes(layerInfo, layerRecords);
  psdPushBytes(layerInfo, layerPixelData);
  if (layerInfo.length % 2) layerInfo.push(0);
  const layerAndMaskBody = [];
  psdPushU32BE(layerAndMaskBody, layerInfo.length);
  psdPushBytes(layerAndMaskBody, layerInfo);
  psdPushU32BE(layerAndMaskBody, 0);
  const layerAndMaskSection = [];
  psdPushU32BE(layerAndMaskSection, layerAndMaskBody.length);
  psdPushBytes(layerAndMaskSection, layerAndMaskBody);
  const compositeData = [];
  psdPushU16BE(compositeData, 0);
  for (const channel of [0, 1, 2, 3])
    psdPushBytes(compositeData, psdChannelBytes(composite, channel));
  return new Blob(
    [
      new Uint8Array(header),
      new Uint8Array(colorModeData),
      new Uint8Array(imageResources),
      new Uint8Array(layerAndMaskSection),
      new Uint8Array(compositeData),
    ],
    { type: "image/vnd.adobe.photoshop" },
  );
}
async function exportPSD(state, opts) {
  const selected = [
    opts.psdPanelBase,
    opts.psdArtwork,
    opts.psdHoles,
    opts.psdComponents,
    opts.psdText,
  ].some(Boolean);
  if (!selected) {
    alert("Select at least one PSD layer.");
    return;
  }
  const widthMM = panelWidthMM(state.panel);
  const heightMM = PANEL_HEIGHT_MM;
  const dpi = Number.isFinite(opts.psdDpi) ? Math.max(72, opts.psdDpi) : 300;
  const layerDefs = [];
  if (opts.psdPanelBase)
    layerDefs.push({
      name: "Panel base",
      svg: exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: false,
        includeArtwork: false,
        includeText: false,
        transparentBg: false,
        includePanelOutline: true,
      }),
    });
  if (opts.psdArtwork)
    layerDefs.push({
      name: "Artwork",
      svg: exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: false,
        includeArtwork: true,
        includeText: false,
        transparentBg: true,
        includePanelOutline: false,
      }),
    });
  if (opts.psdHoles)
    layerDefs.push({
      name: "Holes",
      svg: exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: true,
        includeArtwork: false,
        includeText: false,
        transparentBg: true,
        includePanelOutline: false,
      }),
    });
  if (opts.psdComponents)
    layerDefs.push({
      name: "Components",
      svg: exportPNGSVGString(state, opts, {
        includeComponents: true,
        includeHoles: false,
        includeArtwork: false,
        includeText: false,
        transparentBg: true,
        includePanelOutline: false,
      }),
    });
  if (opts.psdText)
    layerDefs.push({
      name: "Text",
      svg: exportPNGSVGString(state, opts, {
        includeComponents: false,
        includeHoles: false,
        includeArtwork: false,
        includeText: true,
        transparentBg: true,
        includePanelOutline: false,
      }),
    });
  const compositeSvg = exportPNGSVGString(state, opts, {
    includeComponents: !!opts.psdComponents,
    includeHoles: !!opts.psdHoles,
    includeArtwork: !!opts.psdArtwork,
    includeText: !!opts.psdText,
    transparentBg: !opts.psdPanelBase,
    includePanelOutline: !!opts.psdPanelBase,
  });
  try {
    const [composite, ...layerImages] = await Promise.all([
      rasterizeSVGToImageData(compositeSvg, widthMM, heightMM, dpi),
      ...layerDefs.map((l) =>
        rasterizeSVGToImageData(l.svg, widthMM, heightMM, dpi),
      ),
    ]);
    const layers = layerDefs.map((l, i) => ({
      name: l.name,
      data: layerImages[i],
    }));
    const blob = makeLayeredPSD(layers, composite);
    const base = safeProjectFileName(
      state.projectMeta?.name || "panel-layout",
    ).replace(/\.json$/i, "");
    downloadBlobFile(`${base}__layers.psd`, blob);
  } catch (e) {
    alert(`PSD export failed:${e?.message || e}`);
  }
}

// below function prevents html injection
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function field(formData: Record<string, unknown>, key: string) {
  const value = formData[key];
  return typeof value === "string" ? escapeHtml(value) : "";
}

// One poster page. Bangla stays as text so the spelling is exact.
const photoPlaces = new Set(["center", "center top", "center bottom"]);

// True when a hex color is too pale to read on the light page or as footer text.
function isLight(hex: string) {
  const n = hex.replace("#", "");
  if (n.length !== 6) return false;
  const r = Number.parseInt(n.slice(0, 2), 16);
  const g = Number.parseInt(n.slice(2, 4), 16);
  const b = Number.parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some((part) => Number.isNaN(part))) return false;
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

export function buildPosterHtml(input: {
  formData: Record<string, unknown>;
  photoUrls: string[];
  colors: string[];
  photoSlots: number;
  objectPosition?: string;
  border?: string;
  pattern?: string;
  clean?: boolean;
}) {
  const headline = field(input.formData, "headline");
  const name = field(input.formData, "name");
  const designation = field(input.formData, "designation");
  const place = [field(input.formData, "party"), field(input.formData, "district")]
    .filter(Boolean)
    .join(" · ");
  const footer = [
    name ? `<p class="name">${name}</p>` : "",
    designation ? `<p>${designation}</p>` : "",
    place ? `<p>${place}</p>` : "",
    `<p class="credit">প্রচারে</p>`,
  ].join("");
  const urls = input.photoUrls.slice(0, input.photoSlots);
  // One photo is the large portrait. Two stay in the top row. Three: two on top, the third large.
  // The old rule sized one row: 480, 340, or 220. Those widths are not used.
  const topUrls = input.photoSlots >= 3 ? urls.slice(0, 2) : input.photoSlots === 2 ? urls : [];
  const largeUrl = input.photoSlots >= 3 ? urls[2] ?? "" : input.photoSlots === 1 ? urls[0] ?? "" : "";
  const topPhotos = topUrls.map((url) => `<img src="${escapeHtml(url)}" alt="">`).join("");
  const largePhoto = largeUrl ? `<img class="portrait" src="${escapeHtml(largeUrl)}" alt="">` : "";
  // The form used to pick Nirmala or Noto. Posters stay on Noto Sans Bengali.
  const headlineFont = '"Noto Sans Bengali","Nirmala UI",sans-serif';
  const bg = input.colors[0] || "#006A4E";
  const accent = input.colors[1] || "#F42A41";
  // A pale accent, such as white on a condolence design, cannot be the headline on a light page.
  const headlineInk = isLight(accent) ? (isLight(bg) ? "#1f1a14" : bg) : accent;
  const footerInk = isLight(bg) ? "#1f1a14" : "#ffffff";
  // Only the three known crops are written into CSS. Anything else stays centered.
  const objectPosition = photoPlaces.has(input.objectPosition ?? "") ? input.objectPosition : "center";
  // thin is a narrow white frame. thick is a wide one. Anything else is no frame.
  const frame = input.border === "thin" ? "8px solid #fff" : input.border === "thick" ? "24px solid #fff" : "0";
  // The page used to be one solid color. Stripes and dots now sit on a light wash.
  const wash = `linear-gradient(180deg, #f7f4ef 0 58%, ${bg} 100%)`;
  const background =
    input.pattern === "stripes"
      ? `repeating-linear-gradient(135deg, transparent 0 36px, ${bg}33 36px 48px), ${wash}`
      : input.pattern === "dots"
        ? `radial-gradient(circle, ${bg}55 2px, transparent 2.5px) 0 0 / 24px 24px, ${wash}`
        : wash;

  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali&display=swap"><style>
    body{margin:0;width:1200px;height:1600px;box-sizing:border-box;border:${frame};position:relative;overflow:hidden;background:${background};color:#1f1a14;font-family:"Nirmala UI","Segoe UI",sans-serif}
    .top{display:flex;align-items:center;justify-content:center;gap:28px;padding:48px 48px 0;position:relative;z-index:1}
    .top-photos{display:flex;gap:24px}
    .top-photos img{width:180px;height:180px;object-fit:cover;object-position:${objectPosition};border:8px solid ${accent};border-radius:16px;background:#fff}
    .middle{display:flex;align-items:center;gap:36px;min-height:760px;padding:36px 64px 220px;position:relative;z-index:1}
    .middle.solo{justify-content:center}
    .portrait{width:460px;height:620px;object-fit:cover;object-position:${objectPosition};border:10px solid ${accent};background:#fff}
    h1{flex:1;margin:0;font-size:84px;line-height:1.15;text-align:center;color:${headlineInk};font-family:${headlineFont}}
    .solo h1{font-size:96px}
    footer{position:absolute;left:0;right:0;bottom:0;z-index:3;background:${bg};color:${footerInk};text-align:center;padding:28px 24px 32px}
    footer::before{content:"";position:absolute;left:-8%;right:-8%;top:-64px;height:80px;background:${bg};border-radius:50% 50% 0 0}
    footer p{margin:6px 0;font-size:32px}
    footer .name{font-size:64px;margin:0}
    footer .credit{font-size:24px}
    .watermark{position:absolute;left:50%;top:42%;z-index:2;transform:translate(-50%,-50%) rotate(-24deg);font-size:140px;opacity:.28;pointer-events:none;color:${bg}}
    /* The green field and disc was a Bangladesh flag. The poster does not draw it, so these rules are unused. */
    .flag{width:120px;height:72px;background:${bg};border-radius:4px;position:relative;flex:0 0 auto}
    .flag span{position:absolute;left:36px;top:16px;width:40px;height:40px;border-radius:50%;background:${accent}}
    .paddy,.dove{position:absolute;pointer-events:none;opacity:.22;z-index:0}
    .paddy{left:80px;bottom:240px;width:1040px;height:160px}
    .dove{right:72px;top:220px;width:200px;height:100px}
  </style></head><body><div class="top"><!-- The flag mark is not printed. <div class="flag" aria-hidden="true"><span></span></div> --><div class="top-photos">${topPhotos}</div></div><div class="middle${largeUrl ? "" : " solo"}">${largePhoto}<h1>${headline}</h1></div><svg class="paddy" viewBox="0 0 200 80" aria-hidden="true"><path d="M10 70 Q30 20 50 70 Q70 20 90 70 Q110 20 130 70 Q150 20 170 70" fill="none" stroke="${bg}" stroke-width="3"/></svg><svg class="dove" viewBox="0 0 80 40" aria-hidden="true"><path d="M5 25 Q25 5 45 20 Q60 8 75 18 Q55 22 40 28 Q25 36 5 25" fill="${bg}"/></svg>${input.clean ? "" : `<p class="watermark">নমুনা</p>`}<footer>${footer}</footer></body></html>`;
}

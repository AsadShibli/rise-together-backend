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
  const photos = input.photoUrls
    .slice(0, input.photoSlots)
    .map((url) => `<img src="${escapeHtml(url)}" alt="">`)
    .join("");
  // Only these two families are written into CSS. Anything else stays on Nirmala.
  const headlineFont =
    input.formData.font === "noto"
      ? '"Noto Sans Bengali","Nirmala UI",sans-serif'
      : '"Nirmala UI","Segoe UI",sans-serif';
  // One photo is large, two are medium, three stay the smaller row.
  const photoWidth = input.photoSlots === 1 ? 480 : input.photoSlots === 2 ? 340 : 220;
  const bg = input.colors[0] || "#006A4E";
  const accent = input.colors[1] || "#F42A41";
  // Only the three known crops are written into CSS. Anything else stays centered.
  const objectPosition = photoPlaces.has(input.objectPosition ?? "") ? input.objectPosition : "center";
  // thin is a narrow white frame. thick is a wide one. Anything else is no frame.
  const frame = input.border === "thin" ? "8px solid #fff" : input.border === "thick" ? "24px solid #fff" : "0";
  // stripes and dots sit on the flat color. Anything else stays one solid color.
  const background =
    input.pattern === "stripes"
      ? `repeating-linear-gradient(135deg, ${bg} 0 36px, rgba(255,255,255,.2) 36px 48px)`
      : input.pattern === "dots"
        ? `radial-gradient(circle, rgba(255,255,255,.35) 2px, transparent 2.5px) 0 0 / 24px 24px, ${bg}`
        : bg;

  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali&display=swap"><style>
    body{margin:0;width:1200px;height:1600px;box-sizing:border-box;border:${frame};display:flex;flex-direction:column;background:${background};color:#fff;font-family:"Nirmala UI","Segoe UI",sans-serif}
    h1{font-size:72px;text-align:center;font-family:${headlineFont}}
    .photos{display:flex;justify-content:center;gap:16px}
    .photos img{width:${photoWidth}px;height:260px;object-fit:cover;object-position:${objectPosition}}
    /* margin-top:auto pushes this red band to the bottom of the page */
    footer{margin-top:auto;background:${accent};padding:24px;text-align:center;font-size:28px}
    footer p{margin:4px 0}
    .name{font-size:40px}
    .credit{font-size:22px}
    .watermark{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%) rotate(-24deg);font-size:140px;opacity:.28;pointer-events:none}
    /* Flag motif: the field uses the poster background color and the disc uses the accent. */
    .flag{width:120px;height:72px;margin:0 auto 16px;background:${bg};border-radius:4px;position:relative;z-index:1}
    .flag span{position:absolute;left:36px;top:16px;width:40px;height:40px;border-radius:50%;background:${accent}}
    /* Reference decorations. They sit behind the text and do not replace stripes or dots. */
    .paddy,.dove{position:absolute;pointer-events:none;opacity:.22;z-index:0}
    .paddy{left:80px;bottom:220px;width:1040px;height:180px}
    .dove{right:80px;top:280px;width:220px;height:110px}
    h1,.photos,footer{position:relative;z-index:1}
  </style></head><body style="position:relative"><h1>${headline}</h1><div class="flag" aria-hidden="true"><span></span></div><div class="photos">${photos}</div><svg class="paddy" viewBox="0 0 200 80" aria-hidden="true"><path d="M10 70 Q30 20 50 70 Q70 20 90 70 Q110 20 130 70 Q150 20 170 70" fill="none" stroke="#fff" stroke-width="3"/></svg><svg class="dove" viewBox="0 0 80 40" aria-hidden="true"><path d="M5 25 Q25 5 45 20 Q60 8 75 18 Q55 22 40 28 Q25 36 5 25" fill="#fff"/></svg>${input.clean ? "" : `<p class="watermark">নমুনা</p>`}<footer>${footer}</footer></body></html>`;
}

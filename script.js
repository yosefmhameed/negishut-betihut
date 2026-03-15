const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSYvtQi3Hs_wP74x6GjGcuF-6K5r4NF8_ze077InNek7XMrYFFPcVVoAHEDCSXfb0oP4JhKCjsStC_F/pub?output=csv&t=" +
  new Date().getTime();

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function extractGoogleDriveFileId(url) {
  if (!url) return "";

  const trimmed = url.trim();

  let match = trimmed.match(/\/file\/d\/([^/]+)/);
  if (match) return match[1];

  match = trimmed.match(/[?&]id=([^&]+)/);
  if (match) return match[1];

  return "";
}

function normalizeImageUrl(url) {
  if (!url) return "";

  const trimmed = url.trim();
  const fileId = extractGoogleDriveFileId(trimmed);

  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return trimmed;
}

function buildFallbackImageUrls(url) {
  const trimmed = (url || "").trim();
  const fileId = extractGoogleDriveFileId(trimmed);

  if (!fileId) return [trimmed];

  return [
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/uc?export=view&id=${fileId}`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
    trimmed,
  ];
}

function csvToObjects(csvText) {
  const lines = csvText
    .trim()
    .split("\n")
    .map((line) => line.replace(/\r/g, ""));

  const headers = parseCSVLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const obj = {};

    headers.forEach((header, index) => {
      obj[header] = values[index] ?? "";
    });

    return {
      id: Number(obj.id),
      name: obj.name,
      price: obj.price,
      shortDescription: obj.shortDescription,
      fullDescription: obj.fullDescription,
      mainImage: normalizeImageUrl(obj.mainImage),
      mainImageFallbacks: buildFallbackImageUrls(obj.mainImage),
      gallery: obj.gallery
        ? obj.gallery
            .split(",")
            .map((item) => normalizeImageUrl(item))
            .filter(Boolean)
        : [],
      galleryFallbacks: obj.gallery
        ? obj.gallery
            .split(",")
            .map((item) => buildFallbackImageUrls(item))
            .filter((arr) => arr.length > 0)
        : [],
      inStock: String(obj.inStock).toUpperCase() === "TRUE",
      visible: String(obj.visible).toUpperCase() === "TRUE",
    };
  });
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function imageTagWithFallbacks(fallbacks, alt, className) {
  const safeAlt = escapeHtml(alt);
  const safeClass = escapeHtml(className);
  const urls = Array.isArray(fallbacks) ? fallbacks.filter(Boolean) : [];
  const primary = urls[0] || "";

  return `
    <img
      src="${escapeHtml(primary)}"
      alt="${safeAlt}"
      class="${safeClass}"
      data-fallbacks='${escapeHtml(JSON.stringify(urls))}'
      onerror="handleImageFallback(this)"
    />
  `;
}

window.handleImageFallback = function handleImageFallback(img) {
  try {
    const raw = img.getAttribute("data-fallbacks") || "[]";
    const fallbacks = JSON.parse(raw);
    const currentIndex = Number(img.dataset.fallbackIndex || "0");
    const nextIndex = currentIndex + 1;

    if (nextIndex < fallbacks.length) {
      img.dataset.fallbackIndex = String(nextIndex);
      img.src = fallbacks[nextIndex];
      return;
    }

    img.onerror = null;
  } catch (e) {
    img.onerror = null;
  }
};

async function loadProducts() {
  try {
    const response = await fetch(SHEET_CSV_URL);
    const csvText = await response.text();
    const products = csvToObjects(csvText);

    const visibleProducts = products.filter(
      (product) => product.visible !== false
    );

    const productsGrid = document.getElementById("productsGrid");

    productsGrid.innerHTML = visibleProducts
      .map(
        (product) => `
        <a href="product.html?id=${product.id}" class="product-card-link">
          <div class="product-card">
            ${imageTagWithFallbacks(
              product.mainImageFallbacks,
              product.name,
              "product-image"
            )}

            <div class="product-content">
              <div class="product-top">
                <h4>${escapeHtml(product.name)}</h4>
                <span class="price">${escapeHtml(product.price)}</span>
              </div>

              <p class="product-short">${escapeHtml(
                product.shortDescription
              )}</p>
            </div>
          </div>
        </a>
      `
      )
      .join("");
  } catch (error) {
    console.error("Error loading products:", error);
    document.getElementById("productsGrid").innerHTML =
      "<p>אירעה שגיאה בטעינת המוצרים.</p>";
  }
}

loadProducts();
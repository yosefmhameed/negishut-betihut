const phoneNumber = "0526844553";
const whatsappNumber = "972526844553";

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

function imageTagWithFallbacks(fallbacks, alt, className, extraAttributes = "") {
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
      ${extraAttributes}
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

function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("id"));
}

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function initLightbox(images) {
  const lightbox = document.getElementById("lightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const closeBtn = document.getElementById("lightboxClose");
  const prevBtn = document.getElementById("lightboxPrev");
  const nextBtn = document.getElementById("lightboxNext");

  if (!lightbox || !lightboxImage || !closeBtn || !prevBtn || !nextBtn) return;

  let currentIndex = 0;

  function renderImage() {
    lightboxImage.src = images[currentIndex];
    lightboxImage.alt = `תמונת מוצר ${currentIndex + 1}`;
  }

  function openLightbox(index) {
    currentIndex = index;
    renderImage();
    lightbox.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("active");
    document.body.style.overflow = "";
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    renderImage();
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % images.length;
    renderImage();
  }

  document.querySelectorAll(".gallery-thumb").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const index = Number(thumb.dataset.index);
      openLightbox(index);
    });
  });

  const mainImage = document.getElementById("mainProductImage");
  if (mainImage) {
    mainImage.addEventListener("click", () => {
      const index = Number(mainImage.dataset.index || 0);
      openLightbox(index);
    });
  }

  closeBtn.addEventListener("click", closeLightbox);
  prevBtn.addEventListener("click", showPrev);
  nextBtn.addEventListener("click", showNext);

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("active")) return;

    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showPrev();
    if (e.key === "ArrowRight") showNext();
  });
}

function initProductGallery(images) {
  const mainImage = document.getElementById("mainProductImage");
  const thumbs = document.querySelectorAll(".gallery-thumb");

  if (!mainImage || thumbs.length === 0) return;

  function setActiveImage(index) {
    mainImage.src = images[index];
    mainImage.dataset.index = index;

    thumbs.forEach((thumb) => {
      thumb.classList.remove("active");
    });

    const activeThumb = document.querySelector(
      `.gallery-thumb[data-index="${index}"]`
    );
    if (activeThumb) activeThumb.classList.add("active");
  }

  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const index = Number(thumb.dataset.index);
      setActiveImage(index);
    });
  });

  setActiveImage(0);
}

async function loadProductDetails() {
  try {
    const productId = getProductIdFromUrl();
    const response = await fetch(SHEET_CSV_URL);
    const csvText = await response.text();
    const products = csvToObjects(csvText);

    const visibleProducts = products.filter((item) => item.visible !== false);
    const product = visibleProducts.find((item) => item.id === productId);
    const container = document.getElementById("productDetails");

    if (!product) {
      container.innerHTML = `
        <div class="product-not-found">
          <h2>המוצר לא נמצא</h2>
          <a href="index.html" class="btn btn-outline">חזרה לדף הראשי</a>
        </div>
      `;
      return;
    }

    document.title = `${product.name} - מחאמיד ע.א מוצרי נגישות ובטיחות`;

    const rawGallery =
      product.gallery && product.gallery.length > 0
        ? product.gallery.filter((img) => img !== product.mainImage)
        : [];

    const rawGalleryFallbacks =
      product.galleryFallbacks && product.galleryFallbacks.length > 0
        ? product.galleryFallbacks.filter((arr) => arr[0] !== product.mainImage)
        : [];

    const productImages = [product.mainImage, ...rawGallery];
    const productImageFallbacks = [
      product.mainImageFallbacks,
      ...rawGalleryFallbacks,
    ];

    const hasMultipleImages = productImages.length > 1;

    const galleryThumbsHtml = hasMultipleImages
      ? `
        <div class="product-thumbs-grid">
          ${productImageFallbacks
            .map(
              (fallbacks, index) =>
                imageTagWithFallbacks(
                  fallbacks,
                  product.name,
                  "gallery-thumb",
                  `data-index="${index}"`
                )
            )
            .join("")}
        </div>
      `
      : "";

    const relatedProducts = shuffleArray(
      visibleProducts.filter((item) => item.id !== productId)
    ).slice(0, 3);

    const relatedProductsHtml =
      relatedProducts.length > 0
        ? `
          <section class="related-products-section">
            <div class="section-head related-head">
              <div>
                <p class="section-label">מוצרים נוספים</p>
                <h3>מוצרים נוספים שעשויים לעניין אותך</h3>
              </div>
            </div>

            <div class="products-grid">
              ${relatedProducts
                .map(
                  (item) => `
                    <a href="product.html?id=${item.id}" class="product-card-link">
                      <div class="product-card">
                        ${imageTagWithFallbacks(
                          item.mainImageFallbacks,
                          item.name,
                          "product-image"
                        )}
                        <div class="product-content">
                          <div class="product-top">
                            <h4>${escapeHtml(item.name)}</h4>
                            <span class="price">${escapeHtml(item.price)}</span>
                          </div>
                          <p class="product-short">${escapeHtml(
                            item.shortDescription
                          )}</p>
                        </div>
                      </div>
                    </a>
                  `
                )
                .join("")}
            </div>
          </section>
        `
        : "";

    container.innerHTML = `
      <div class="product-page-layout">
        <div class="product-media-column">
          <div class="hero-image-card product-main-image-card">
            ${imageTagWithFallbacks(
              product.mainImageFallbacks,
              product.name,
              "hero-image clickable-image",
              `id="mainProductImage" data-index="0"`
            )}
          </div>

          ${galleryThumbsHtml}
        </div>

        <div class="hero-text">
          <p class="section-label">פרטי מוצר</p>
          <h2>${escapeHtml(product.name)}</h2>
          <p>${escapeHtml(product.fullDescription)}</p>
          <p class="product-page-price">${escapeHtml(product.price)}</p>
          <p class="stock-status">
            ${product.inStock ? "זמין במלאי" : "אזל מהמלאי"}
          </p>

          <div class="hero-buttons">
            <a
              href="https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                `שלום, אני מעוניין במוצר: ${product.name}`
              )}"
              target="_blank"
              rel="noreferrer"
              class="btn btn-primary"
            >
              להזמנה בוואטסאפ
            </a>

            <a href="tel:${phoneNumber}" class="btn btn-outline">
              התקשרו עכשיו
            </a>

            <a href="index.html" class="btn btn-outline">
              חזרה לדף הראשי
            </a>
          </div>
        </div>
      </div>

      ${relatedProductsHtml}

      <div id="lightbox" class="lightbox">
        <button id="lightboxClose" class="lightbox-close" aria-label="סגור">×</button>
        <button id="lightboxPrev" class="lightbox-nav lightbox-prev" aria-label="הקודם">›</button>
        <img id="lightboxImage" class="lightbox-image" src="" alt="תמונה מוגדלת" />
        <button id="lightboxNext" class="lightbox-nav lightbox-next" aria-label="הבא">‹</button>
      </div>
    `;

    if (hasMultipleImages) {
      initProductGallery(productImages);
    }

    initLightbox(productImages);
  } catch (error) {
    console.error("Error loading product details:", error);
    document.getElementById("productDetails").innerHTML =
      "<p>אירעה שגיאה בטעינת פרטי המוצר.</p>";
  }
}

loadProductDetails();
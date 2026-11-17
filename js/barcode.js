// Barcode scanning on the Calories page: read a packaged food's barcode with
// the camera, then look the product up in Open Food Facts (a free public food
// database, no key needed), falling back to USDA's list of packaged foods.
const Barcode = (() => {
  const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v2/product/";
  const OPEN_FOOD_FACTS_FIELDS = "product_name,brands,serving_size,serving_quantity,nutriments";
  // iPhone Safari has no built-in barcode reader, so this library adds one.
  // Pinned so a new release can't change the app without us noticing.
  const SCANNER_URL = "https://cdn.jsdelivr.net/npm/barcode-detector@3.2.3/dist/es/ponyfill.min.js";
  // The barcodes printed on food packages (UPC in the US, EAN elsewhere).
  const FORMATS = ["upc_a", "upc_e", "ean_13", "ean_8"];
  const BARCODE_LENGTHS = [8, 12, 13, 14];
  const SCAN_INTERVAL_MS = 200;
  const KJ_PER_KCAL = 4.184;

  // Shown to the person as it is.
  class BarcodeError extends Error {
    constructor(message) {
      super(message);
      this.name = "BarcodeError";
    }
  }

  // Digits only, and only lengths that food barcodes come in; otherwise null.
  function cleanCode(text) {
    const digits = String(text || "").replace(/[\s-]/g, "");
    return /^\d+$/.test(digits) && BARCODE_LENGTHS.includes(digits.length) ? digits : null;
  }

  function numberOrNull(value) {
    const number = Number(value);
    return value !== undefined && value !== "" && Number.isFinite(number) && number >= 0 ? number : null;
  }

  // "1 package (28.349 g)" → "1 package"; a label that is only a weight ("30g") → "1 serving".
  function servingLabel(servingSize) {
    const label = String(servingSize || "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim();
    return label && !/^[\d.,\s]+(g|ml)$/i.test(label) ? label : "1 serving";
  }

  // Turns an Open Food Facts product into the app's food shape (the same one
  // USDA search results use), or null when it has no calories listed.
  function fromOpenFoodFacts(code, product) {
    const nutriments = (product && product.nutriments) || {};
    const servingGrams = numberOrNull(product && product.serving_quantity);
    // Per 100 g if listed; otherwise worked out from the per-serving value.
    const per100g = (name) => {
      const value = numberOrNull(nutriments[`${name}_100g`]);
      if (value !== null) {
        return value;
      }
      const perServing = numberOrNull(nutriments[`${name}_serving`]);
      return perServing !== null && servingGrams > 0 ? (perServing * 100) / servingGrams : null;
    };
    let calories = per100g("energy-kcal");
    if (calories === null) {
      const kilojoules = per100g("energy-kj");
      calories = kilojoules === null ? null : kilojoules / KJ_PER_KCAL;
    }
    if (calories === null) {
      return null;
    }
    const brand = String(product.brands || "").split(",")[0].trim();
    return {
      id: `barcode-${code}`,
      name: String(product.product_name || "").trim() || (brand ? `${brand} product` : "Unnamed product"),
      brand,
      branded: true,
      per100g: {
        calories,
        protein: per100g("proteins") || 0,
        carbs: per100g("carbohydrates") || 0,
        fat: per100g("fat") || 0,
      },
      portions: servingGrams > 0 ? [{ label: servingLabel(product.serving_size), grams: servingGrams }] : [],
    };
  }

  async function fromOpenFoodFactsApi(code) {
    const url = `${OPEN_FOOD_FACTS_URL}${code}.json?fields=${OPEN_FOOD_FACTS_FIELDS}`;
    const response = await fetch(url);
    // Open Food Facts answers 404 with { status: 0 } for products it doesn't have.
    if (!response.ok && response.status !== 404) {
      throw new Error(`Open Food Facts error ${response.status}`);
    }
    const data = await response.json();
    return data.status === 1 ? fromOpenFoodFacts(code, data.product) : null;
  }

  // Returns the product as a food, or null if neither database has it.
  async function lookUp(code) {
    let openFoodFactsFailed = false;
    try {
      const food = await fromOpenFoodFactsApi(code);
      if (food) {
        return food;
      }
    } catch {
      openFoodFactsFailed = true;
    }
    try {
      return await FoodSearch.findByBarcode(code);
    } catch {
      if (openFoodFactsFailed) {
        throw new BarcodeError("Couldn't reach the food databases. Check your internet connection and try again.");
      }
      return null;
    }
  }

  async function createDetector() {
    if ("BarcodeDetector" in window) {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      if (FORMATS.every((format) => supported.includes(format))) {
        return new window.BarcodeDetector({ formats: FORMATS });
      }
    }
    let library;
    try {
      library = await import(SCANNER_URL);
    } catch {
      throw new BarcodeError("Couldn't load the scanner. Check your internet connection, or type the number below.");
    }
    return new library.BarcodeDetector({ formats: FORMATS });
  }

  function cameraMessage(error) {
    if (error instanceof BarcodeError) {
      return error.message;
    }
    if (error && error.name === "NotAllowedError") {
      return "Camera access is off for this site. Allow it in Settings → Apps → Safari → Camera, or type the number below.";
    }
    if (error && (error.name === "NotFoundError" || error.name === "OverconstrainedError")) {
      return "No camera found. Type the barcode number below.";
    }
    return "Couldn't start the camera. Type the barcode number below.";
  }

  // Shows the back camera in `video` and calls onCode once with the first
  // barcode it reads (then turns the camera off), or onError with a message.
  // Returns a function that turns the camera off early.
  function startScanning(video, onCode, onError) {
    let stopped = false;
    let stream = null;
    let timer = null;

    function stop() {
      stopped = true;
      clearTimeout(timer);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      video.srcObject = null;
    }

    async function run() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new BarcodeError("This browser can't use the camera here. Type the barcode number below.");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (stopped) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play();
      const detector = await createDetector();
      const scanFrame = async () => {
        if (stopped) {
          return;
        }
        if (video.readyState >= video.HAVE_CURRENT_DATA) {
          try {
            const found = await detector.detect(video);
            const code = found.map((barcode) => cleanCode(barcode.rawValue)).find(Boolean);
            if (code && !stopped) {
              stop();
              onCode(code);
              return;
            }
          } catch {
            // A frame the scanner couldn't read; the next one usually works.
          }
        }
        timer = setTimeout(scanFrame, SCAN_INTERVAL_MS);
      };
      scanFrame();
    }

    run().catch((error) => {
      if (!stopped) {
        stop();
        onError(cameraMessage(error));
      }
    });
    return stop;
  }

  return { BarcodeError, cleanCode, servingLabel, fromOpenFoodFacts, lookUp, startScanning };
})();

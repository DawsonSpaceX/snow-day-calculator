// Core helpers
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const TEMP_MIN_F = -10;
const TEMP_MAX_F = 40;

let currentTempUnit = "fahrenheit";

// DOM refs
const snowRange = document.getElementById("snow-amount");
const snowValue = document.getElementById("snow-value");
const tempRange = document.getElementById("low-temp");
const tempValue = document.getElementById("temp-value");
const tempUnitLabel = document.getElementById("temp-unit-label");
const autoStatus = document.getElementById("auto-status");
const locationInput = document.getElementById("location");
const form = document.getElementById("snow-form");
const resultSection = document.getElementById("result");
const chanceEl = document.getElementById("chance");
const verdictEl = document.getElementById("verdict");
const breakdownEl = document.getElementById("breakdown");
const chipLocation = document.getElementById("chip-location");
const chipSchool = document.getElementById("chip-school");
const confettiContainer = document.getElementById("confetti-container");

// Settings refs
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const settingsClose = document.getElementById("settings-close");
const tempUnitRadios = document.querySelectorAll("input[name='temp-unit']");
const themeRadios = document.querySelectorAll("input[name='theme']");

// Init slider labels
snowValue.textContent = snowRange.value + '"';
tempValue.textContent = tempRange.value + "°F";

snowRange.addEventListener("input", () => {
  snowValue.textContent = snowRange.value + '"';
});

tempRange.addEventListener("input", () => {
  const val = tempRange.value;
  tempValue.textContent =
    currentTempUnit === "fahrenheit"
      ? val + "°F"
      : Math.round(val) + "°C";
});

// Temperature unit handling
function setTempUnit(unit) {
  if (unit === currentTempUnit) return;

  if (unit === "celsius") {
    // Convert existing F slider to C for display
    const currentF = parseFloat(tempRange.value);
    const minC = Math.round(((TEMP_MIN_F - 32) * 5) / 9);
    const maxC = Math.round(((TEMP_MAX_F - 32) * 5) / 9);
    const valC = Math.round(((currentF - 32) * 5) / 9);

    tempRange.min = String(minC);
    tempRange.max = String(maxC);
    tempRange.value = String(valC);
    tempValue.textContent = valC + "°C";
    tempUnitLabel.textContent = "°C";
    currentTempUnit = "celsius";
  } else {
    // Convert slider which is currently in C back to F
    const currentC = parseFloat(tempRange.value);
    const valF = Math.round((currentC * 9) / 5 + 32);

    tempRange.min = String(TEMP_MIN_F);
    tempRange.max = String(TEMP_MAX_F);
    tempRange.value = String(valF);
    tempValue.textContent = valF + "°F";
    tempUnitLabel.textContent = "°F";
    currentTempUnit = "fahrenheit";
  }
}

tempUnitRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (radio.checked) {
      setTempUnit(radio.value);
    }
  });
});

// Theme handling
themeRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    document.body.classList.remove("theme-midnight", "theme-frost", "theme-slate");
    document.body.classList.add("theme-" + radio.value);
  });
});

// Settings panel open/close
function openSettings() {
  settingsPanel.hidden = false;
}

function closeSettings() {
  settingsPanel.hidden = true;
}

settingsToggle.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsPanel.addEventListener("click", (event) => {
  if (event.target === settingsPanel) {
    closeSettings();
  }
});

// Forecast fetching
async function fetchForecastForLocation(name) {
  const geoUrl =
    "https://geocoding-api.open-meteo.com/v1/search?name=" +
    encodeURIComponent(name) +
    "&count=1&language=en&format=json";

  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) {
    throw new Error("Geocoding request failed");
  }
  const geoData = await geoRes.json();
  if (!geoData.results || geoData.results.length === 0) {
    throw new Error("Could not find that city or ZIP");
  }

  const place = geoData.results[0];

  const forecastUrl =
    "https://api.open-meteo.com/v1/forecast?latitude=" +
    place.latitude +
    "&longitude=" +
    place.longitude +
    "&hourly=snowfall,precipitation,temperature_2m" +
    "&daily=temperature_2m_min" +
    "&forecast_days=2&temperature_unit=fahrenheit&timezone=auto";

  const wxRes = await fetch(forecastUrl);
  if (!wxRes.ok) {
    throw new Error("Weather request failed");
  }
  const wxData = await wxRes.json();
  return { place, wxData };
}

function autoFillFromForecast(place, wxData) {
  const hourly = wxData.hourly || {};
  const daily = wxData.daily || {};

  const snowfallArr = hourly.snowfall || [];
  const precipArr = hourly.precipitation || [];
  const tempArr = hourly.temperature_2m || [];
  const times = hourly.time || [];

  // Sum snow & precip over next 24 hours
  const hoursToUse = Math.min(snowfallArr.length, 24);
  let snowMm = 0;
  let precipMm = 0;
  let minTempF = Number.POSITIVE_INFINITY;

  for (let i = 0; i < hoursToUse; i++) {
    const s = typeof snowfallArr[i] === "number" ? snowfallArr[i] : 0;
    const p = typeof precipArr[i] === "number" ? precipArr[i] : 0;
    const t = typeof tempArr[i] === "number" ? tempArr[i] : null;

    snowMm += s;
    precipMm += p;
    if (t !== null && t < minTempF) {
      minTempF = t;
    }
  }

  if (!Number.isFinite(minTempF)) {
    const dailyLow =
      daily.temperature_2m_min && daily.temperature_2m_min.length
        ? daily.temperature_2m_min[0]
        : 32;
    minTempF = dailyLow;
  }

  // Convert to inches
  let snowInches = snowMm / 25.4;
  if (snowInches > 0 && snowInches < 0.1) {
    snowInches = 0.1;
  }

  const sliderSnow = clamp(
    Math.round(snowInches * 10) / 10,
    parseFloat(snowRange.min),
    parseFloat(snowRange.max)
  );
  snowRange.value = String(sliderSnow);
  snowValue.textContent = sliderSnow + '"';

  // Set overnight low slider according to unit
  const sliderTempF = clamp(
    Math.round(minTempF),
    TEMP_MIN_F,
    TEMP_MAX_F
  );

  if (currentTempUnit === "fahrenheit") {
    tempRange.min = String(TEMP_MIN_F);
    tempRange.max = String(TEMP_MAX_F);
    tempRange.value = String(sliderTempF);
    tempValue.textContent = sliderTempF + "°F";
  } else {
    const minC = Math.round(((TEMP_MIN_F - 32) * 5) / 9);
    const maxC = Math.round(((TEMP_MAX_F - 32) * 5) / 9);
    const valC = Math.round(((sliderTempF - 32) * 5) / 9);
    tempRange.min = String(minC);
    tempRange.max = String(maxC);
    tempRange.value = String(valC);
    tempValue.textContent = valC + "°C";
  }

  // Guess ice risk
  let iceRisk = "low";
  if (precipMm > 0 && snowMm > 0 && snowMm < precipMm * 0.7) {
    iceRisk = "medium";
  }
  if (precipMm > 0 && sliderTempF >= 28 && sliderTempF <= 34) {
    iceRisk = "high";
  }
  document.getElementById("ice-risk").value = iceRisk;

  // Determine timing from heaviest precipitation in first 24h
  let maxIndex = -1;
  let maxAmount = 0;

  for (let i = 0; i < hoursToUse; i++) {
    const amount =
      (typeof snowfallArr[i] === "number" ? snowfallArr[i] : 0) +
      (typeof precipArr[i] === "number" ? precipArr[i] : 0);
    if (amount > maxAmount) {
      maxAmount = amount;
      maxIndex = i;
    }
  }

  let timing = "daytime";
  if (maxIndex >= 0 && maxAmount > 0.05 && times.length > maxIndex) {
    const t = times[maxIndex];
    const timePart = t.split("T")[1] || "";
    const hourStr = timePart.slice(0, 2);
    const hour = parseInt(hourStr, 10);
    if (!Number.isNaN(hour)) {
      if (hour < 6) timing = "overnight";
      else if (hour < 11) timing = "morning";
      else timing = "daytime";
    }
  }
  document.getElementById("timing").value = timing;

  autoStatus.textContent =
    "Using forecast for " +
    (place.name || "your location") +
    (place.country ? ", " + place.country : "") +
    ". You can still tweak sliders.";
  autoStatus.classList.remove("error");
}

// Debounced auto-fetch on location input
let forecastDebounce = null;

locationInput.addEventListener("input", () => {
  const query = locationInput.value.trim();
  autoStatus.classList.remove("error");

  if (forecastDebounce) {
    clearTimeout(forecastDebounce);
  }

  if (query.length < 3) {
    autoStatus.textContent = "";
    return;
  }

  forecastDebounce = setTimeout(async () => {
    autoStatus.textContent = "Grabbing forecast…";

    try {
      const { place, wxData } = await fetchForecastForLocation(query);
      autoFillFromForecast(place, wxData);
    } catch (err) {
      console.error(err);
      autoStatus.textContent =
        "Could not load weather for that location. You can still move sliders manually.";
      autoStatus.classList.add("error");
    }
  }, 800);
});

// Confetti for 100% snow day
function triggerConfetti() {
  const colors = ["#38bdf8", "#4f46e5", "#f97316", "#22c55e", "#e5e7eb"];

  for (let i = 0; i < 120; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 1.5 + "s";
    confettiContainer.appendChild(piece);

    setTimeout(() => {
      piece.remove();
    }, 3000);
  }
}

// Calculation logic
form.addEventListener("submit", function (event) {
  event.preventDefault();

  const schoolSelect = document.getElementById("school-level");
  const schoolLevel = schoolSelect.value;
  const schoolLabel = schoolSelect.options[schoolSelect.selectedIndex].text;

  const snow = Number(snowRange.value || 0);
  const ice = document.getElementById("ice-risk").value;
  let tempVal = Number(tempRange.value || 32);
  const timing = document.getElementById("timing").value;
  const rural = document.getElementById("rural").value;
  const locationText = locationInput.value.trim();

  // Convert slider temp to Fahrenheit for scoring if needed
  let tempF = tempVal;
  if (currentTempUnit === "celsius") {
    tempF = (tempVal * 9) / 5 + 32;
  }

  let score = 0;
  const notes = [];

  // Snow amount
  const cappedSnow = Math.min(snow, 14);
  const snowPoints = cappedSnow * 5;
  score += snowPoints;
  notes.push(`${snow.toFixed(1)}" of snow in the forecast (+${snowPoints.toFixed(0)})`);

  // Ice risk
  let iceBonus = 0;
  if (ice === "medium") {
    iceBonus = 10;
    notes.push("Some ice / slush on roads (+10)");
  } else if (ice === "high") {
    iceBonus = 20;
    notes.push("Freezing rain / serious ice risk (+20)");
  } else {
    notes.push("Mostly straight snow, little ice (+0)");
  }
  score += iceBonus;

  // Temperature
  let tempBonus = 0;
  if (tempF <= 10) {
    tempBonus = 10;
    notes.push(`Brutally cold (≤ ${Math.round(tempF)}°F) (+10)`);
  } else if (tempF <= 25) {
    tempBonus = 5;
    notes.push(`Pretty cold (${Math.round(tempF)}°F) (+5)`);
  } else {
    notes.push(`Not crazy cold (${Math.round(tempF)}°F) (+0)`);
  }
  score += tempBonus;

  // Timing
  let timingBonus = 0;
  if (timing === "overnight") {
    timingBonus = 15;
    notes.push("Heaviest snow overnight before buses (+15)");
  } else if (timing === "morning") {
    timingBonus = 8;
    notes.push("Still snowing around bus / commute time (+8)");
  } else {
    notes.push("Snow mainly during school or later (+0)");
  }
  score += timingBonus;

  // Rural vs city
  let ruralBonus = 0;
  if (rural === "rural") {
    ruralBonus = 10;
    notes.push("Lots of back roads & buses (+10)");
  } else {
    notes.push("City/suburban roads get plowed faster (+0)");
  }
  score += ruralBonus;

  // School level
  let schoolBonus = 0;
  if (schoolLevel === "elementary") {
    schoolBonus = 10;
    notes.push("Elementary kids → admin more cautious (+10)");
  } else if (schoolLevel === "middle") {
    schoolBonus = 5;
    notes.push("Middle school (+5)");
  } else if (schoolLevel === "high") {
    schoolBonus = 0;
    notes.push("High school (baseline, +0)");
  } else {
    schoolBonus = -10;
    notes.push("Colleges almost never close (−10)");
  }
  score += schoolBonus;

  const percent = clamp(Math.round(score), 0, 100);
  chanceEl.textContent = percent + "%";

  let verdict;
  if (percent >= 85) {
    verdict = "🔥 Almost guaranteed snow day. Start planning the snacks.";
  } else if (percent >= 65) {
    verdict = "Looking really good. Might not need that alarm.";
  } else if (percent >= 45) {
    verdict = "Total coin flip. Check school alerts before bed.";
  } else if (percent >= 25) {
    verdict = "Leaning toward school, maybe a delay at best.";
  } else {
    verdict = "Yeah… probably school. Sorry. Charge your Chromebook.";
  }
  verdictEl.textContent = verdict;

  breakdownEl.innerHTML = "";
  notes.forEach((n) => {
    const li = document.createElement("li");
    li.textContent = n;
    breakdownEl.appendChild(li);
  });

  chipLocation.textContent =
    locationText.length > 0 ? locationText : "Your location";
  chipSchool.textContent = schoolLabel;

  resultSection.hidden = false;

  // Confetti if we hit 100%
  if (percent >= 99) {
    triggerConfetti();
  }
});

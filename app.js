// Initialiser Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Variables globales
let allEntries = [];
let currentFilter = { date: null, text: "", tag: null };
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// --- Éléments DOM (vérifiés après le chargement) ---
let adminBtn, loginPopup, closeLogin, loginBtn, emailInput, passwordInput;
let journalContent, lockedMessage, newTitle, newContent, newTags, addEntryBtn;
let clearFilters, searchDate, searchText, searchBtn, allTagsDiv, darkToggle;
let calendarDays, monthYear, entriesDiv, entriesDateTitle;

// --- Initialisation après chargement du DOM ---
document.addEventListener("DOMContentLoaded", () => {
  // Récupérer tous les éléments DOM
  adminBtn = document.getElementById("adminBtn");
  loginPopup = document.getElementById("loginPopup");
  closeLogin = document.getElementById("closeLogin");
  loginBtn = document.getElementById("loginBtn");
  emailInput = document.getElementById("email");
  passwordInput = document.getElementById("password");
  journalContent = document.getElementById("journalContent");
  lockedMessage = document.getElementById("lockedMessage");
  newTitle = document.getElementById("newTitle");
  newContent = document.getElementById("newContent");
  newTags = document.getElementById("newTags");
  addEntryBtn = document.getElementById("addEntryBtn");
  clearFilters = document.getElementById("clearFilters");
  searchDate = document.getElementById("searchDate");
  searchText = document.getElementById("searchText");
  searchBtn = document.getElementById("searchBtn");
  allTagsDiv = document.getElementById("allTags");
  darkToggle = document.getElementById("darkToggle");
  calendarDays = document.getElementById("calendarDays");
  monthYear = document.getElementById("monthYear");
  entriesDiv = document.getElementById("entries");
  entriesDateTitle = document.getElementById("entriesDateTitle");

  // --- Dark Mode ---
  const savedDark = localStorage.getItem("journal-dark") === "1";
  if (savedDark) document.body.classList.add("dark");
  darkToggle.textContent = savedDark ? "☀️" : "🌙";
  darkToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("journal-dark", isDark ? "1" : "0");
    darkToggle.textContent = isDark ? "☀️" : "🌙";
  });

  // --- Admin Login ---
  adminBtn.addEventListener("click", () => { loginPopup.style.display = "flex"; });
  closeLogin.addEventListener("click", () => { loginPopup.style.display = "none"; });
  loginBtn.addEventListener("click", () => {
    const email = emailInput.value.trim();
    const pwd = passwordInput.value.trim();
    if (!email || !pwd) { alert("Email et mot de passe requis"); return; }
    auth.signInWithEmailAndPassword(email, pwd)
      .then(() => { loginPopup.style.display = "none"; })
      .catch((e) => alert(e.message));
  });

  auth.onAuthStateChanged((user) => {
    if (user) {
      lockedMessage.style.display = "none";
      journalContent.style.display = "block";
      startRealtime();
    } else {
      journalContent.style.display = "none";
      lockedMessage.style.display = "block";
    }
  });

  // --- Calendrier ---
  generateCalendar(currentMonth, currentYear);

  // --- Ajouter une entrée ---
  addEntryBtn.addEventListener("click", () => {
    if (!auth.currentUser) { alert("Tu dois être connecté."); return; }
    const title = newTitle.value.trim();
    const content = newContent.value.trim();
    const tags = (newTags.value || "").split(",").map(tag => tag.trim()).filter(Boolean);
    if (!title && !content) { alert("Titre ou contenu requis"); return; }

    db.collection("entries").add({
      title: title || "(sans titre)",
      content: content || "",
      tags: tags,
      date: new Date().toISOString(),
    }).then(() => {
      newTitle.value = ""; newContent.value = ""; newTags.value = "";
    });
  });

  // --- Recherche ---
  searchBtn.addEventListener("click", () => {
    currentFilter = {
      date: searchDate.value,
      text: searchText.value.toLowerCase(),
      tag: null,
    };
    applyFilters();
  });

  // --- Réinitialiser les filtres ---
  clearFilters.addEventListener("click", () => {
    currentFilter = { date: null, text: "", tag: null };
    searchDate.value = "";
    searchText.value = "";
    applyFilters();
  });
});

// --- Calendrier ---
function generateCalendar(month, year) {
  if (!calendarDays || !monthYear) return; // Vérification de sécurité

  calendarDays.innerHTML = "";
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  monthYear.textContent = `${monthNames[month]} ${year}`;

  // Jours du mois précédent
  for (let i = firstDay - 1; i >= 0; i--) {
    const dayElement = createDayElement(daysInPrevMonth - i, "other-month");
    calendarDays.appendChild(dayElement);
  }

  // Jours du mois courant
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    const today = new Date().toISOString().split("T")[0];
    const dayElement = createDayElement(i, "", dateStr);
    if (dateStr === today) dayElement.classList.add("today");

    const hasEntries = allEntries.some(entry => entry.data.date && entry.data.date.startsWith(dateStr));
    if (hasEntries) dayElement.classList.add("has-entries");
    calendarDays.appendChild(dayElement);
  }

  // Jours du mois suivant
  const totalDays = firstDay + daysInMonth;
  const remainingDays = 7 - (totalDays % 7);
  if (remainingDays < 7) {
    for (let i = 1; i <= remainingDays; i++) {
      const dayElement = createDayElement(i, "other-month");
      calendarDays.appendChild(dayElement);
    }
  }
}

function createDayElement(day, className, dateStr = "") {
  const dayElement = document.createElement("div");
  dayElement.className = `calendar-day ${className}`;
  dayElement.textContent = day;
  if (dateStr) {
    dayElement.dataset.date = dateStr;
    dayElement.addEventListener("click", () => showEntriesForDate(dateStr));
  }
  return dayElement;
}

function showEntriesForDate(dateStr) {
  if (!entriesDiv || !entriesDateTitle) return; // Vérification de sécurité

  const date = new Date(dateStr);
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  entriesDateTitle.textContent = `Entrées pour le ${date.toLocaleDateString("fr-FR", options)}`;

  const filteredEntries = allEntries.filter(entry => entry.data.date && entry.data.date.startsWith(dateStr));
  renderEntries(filteredEntries);
}

// Navigation entre les mois
document.getElementById("prevMonth")?.addEventListener("click", () => {
  currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  generateCalendar(currentMonth, currentYear);
});
document.getElementById("nextMonth")?.addEventListener("click", () => {
  currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  generateCalendar(currentMonth, currentYear);
});

// --- Firebase Realtime ---
function startRealtime() {
  db.collection("entries")
    .orderBy("date", "desc")
    .onSnapshot((snapshot) => {
      allEntries = snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data(),
      }));
      console.log("Entrées chargées :", allEntries); // OK si tu vois tes données

      // Convertir les dates si nécessaire
      allEntries.forEach(entry => {
        if (entry.data.date?.toDate) {
          entry.data.date = entry.data.date.toDate().toISOString();
        }
      });

      generateCalendar(currentMonth, currentYear);
      updateUIFromEntries();

      // Force l'affichage de toutes les entrées pour test
      console.log("Appel de renderEntries avec toutes les entrées...");
      renderEntries(allEntries); // <-- Ajoute cette ligne
    });
}

// --- Mise à jour de l'UI ---
function updateUIFromEntries() {
  if (!allTagsDiv || !entriesDiv) return; // Vérification de sécurité

  const tagSet = new Set();
  allEntries.forEach(entry => (entry.data.tags || []).forEach(tag => tagSet.add(tag)));
  renderAllTags(Array.from(tagSet).sort());
  applyFilters(); // Affiche toutes les entrées au démarrage
}

function renderAllTags(tags) {
  if (!allTagsDiv) return; // Vérification de sécurité

  allTagsDiv.innerHTML = "";
  tags.forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "tag";
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      currentFilter.tag = tag;
      applyFilters();
    });
    allTagsDiv.appendChild(btn);
  });
}

// --- Affichage des entrées ---
function renderEntries(entriesToShow) {
  if (!entriesDiv) {
    console.error("Erreur : entriesDiv n'existe pas !");
    return;
  }

  entriesDiv.innerHTML = ""; // Vide le conteneur

  if (!entriesToShow || entriesToShow.length === 0) {
    entriesDiv.innerHTML = "<p>Aucune entrée trouvée.</p>";
    console.log("Aucune entrée à afficher.");
    return;
  }

  console.log("Affichage de", entriesToShow.length, "entrées...");

  entriesToShow.forEach(entry => {
    const entryElement = document.createElement("div");
    entryElement.className = "entry";

    // Gestion des dates
    const dateStr = entry.data.date ?
      new Date(entry.data.date).toLocaleString("fr-FR") :
      "Date inconnue";

    // Gestion des tags
    const tagsHtml = entry.data.tags && entry.data.tags.length > 0 ?
      `<div class="entry-tags">${entry.data.tags.map(tag => `<span class="tag">${tag}</span>`).join(" ")}</div>` :
      "";

    entryElement.innerHTML = `
      <div class="meta">
        <div class="title">${entry.data.title || "(sans titre)"}</div>
        <div class="date">${dateStr}</div>
      </div>
      <p>${entry.data.content || "(aucun contenu)"}</p>
      ${tagsHtml}
    `;

    entriesDiv.appendChild(entryElement);
  });
}

// --- Appliquer les filtres ---
function applyFilters() {
  if (!entriesDiv || !entriesDateTitle) return; // Vérification de sécurité

  const fDate = currentFilter.date;
  const fText = (currentFilter.text || "").toLowerCase();
  const fTag = currentFilter.tag;

  let title = "Toutes les entrées";
  if (fDate) title = `Entrées pour le ${new Date(fDate).toLocaleDateString("fr-FR")}`;
  else if (fTag) title = `Entrées avec le tag "${fTag}"`;
  else if (fText) title = `Résultats pour "${fText}"`;
  entriesDateTitle.textContent = title;

  const filtered = allEntries.filter(entry => {
    const entryDate = entry.data.date ? entry.data.date.slice(0, 10) : null;
    if (fDate && entryDate !== fDate) return false;
    if (fTag && !(entry.data.tags || []).some(tag => tag.toLowerCase() === fTag.toLowerCase())) return false;
    if (fText && !(entry.data.title + " " + entry.data.content + " " + (entry.data.tags || []).join(" ")).toLowerCase().includes(fText)) return false;
    return true;
  });

  renderEntries(filtered);
}

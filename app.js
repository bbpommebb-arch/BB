// Initialiser Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Variables globales
let allEntries = [];
let currentFilter = { date: null, text: "", tag: null };
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// --- Éléments DOM ---
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
  if (!calendarDays || !monthYear) return;
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
  if (!entriesDiv || !entriesDateTitle) return;
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

      allEntries.forEach(entry => {
        if (entry.data.date?.toDate) {
          entry.data.date = entry.data.date.toDate().toISOString();
        }
      });

      generateCalendar(currentMonth, currentYear);
      updateUIFromEntries();
    });
}

// --- Mise à jour de l'UI ---
function updateUIFromEntries() {
  const tagSet = new Set();
  allEntries.forEach(entry => (entry.data.tags || []).forEach(tag => tagSet.add(tag)));
  const tags = Array.from(tagSet).sort();
  renderAllTags(tags);
  updateTagDatalist(tags);
  applyFilters();
}

function renderAllTags(tags) {
  if (!allTagsDiv) return;
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

// Mettre à jour le datalist des tags existants
function updateTagDatalist(tags) {
  const datalist = document.getElementById("existingTags");
  if (!datalist) return;
  datalist.innerHTML = "";
  tags.forEach(tag => {
    const option = document.createElement("option");
    option.value = tag;
    datalist.appendChild(option);
  });
}

// --- Affichage des entrées ---
function renderEntries(entriesToShow) {
  entriesDiv.innerHTML = "";
  if (!entriesToShow || entriesToShow.length === 0) {
    entriesDiv.innerHTML = "<p>Aucune entrée trouvée.</p>";
    return;
  }

  entriesToShow.forEach(entry => {
    const entryElement = document.createElement("div");
    entryElement.className = "entry";

    const date = new Date(entry.data.date);
    const dateStr = date.toLocaleString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const tagsHtml = (entry.data.tags || []).length > 0 ?
      `<div class="entry-tags">
        ${entry.data.tags.map(tag => `
          <span class="tag">
            <span class="tag-text">${tag}</span>
            <button class="delete-tag-btn" data-entry-id="${entry.id}" data-tag="${tag}">×</button>
          </span>
        `).join(" ")}
      </div>` :
      "";

    entryElement.innerHTML = `
      <div class="meta">
        <div class="title">${entry.data.title || "(sans titre)"}</div>
        <div class="date">(${dateStr})</div>
        <div class="entry-actions">
          <button class="edit-entry-btn" data-entry-id="${entry.id}">Modifier</button>
          <button class="delete-entry-btn" data-entry-id="${entry.id}">Supprimer</button>
        </div>
      </div>
      <p>${entry.data.content || "(aucun contenu)"}</p>
      ${tagsHtml}
      <div class="add-tag-section">
        <button class="add-tag-btn" data-entry-id="${entry.id}">+ Ajouter un tag</button>
      </div>
    `;
    entriesDiv.appendChild(entryElement);
  });

  // Ajouter les écouteurs d'événements
  document.querySelectorAll(".delete-entry-btn").forEach(button => {
    button.addEventListener("click", (e) => {
      const entryId = e.target.dataset.entryId;
      if (confirm("Voulez-vous vraiment supprimer cette entrée ?")) {
        deleteEntry(entryId);
      }
    });
  });

  document.querySelectorAll(".delete-tag-btn").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const entryId = e.target.dataset.entryId;
      const tag = e.target.dataset.tag;
      if (confirm(`Voulez-vous vraiment supprimer le tag "${tag}" ?`)) {
        deleteTag(entryId, tag);
      }
    });
  });

  document.querySelectorAll(".edit-entry-btn").forEach(button => {
    button.addEventListener("click", (e) => {
      const entryId = e.target.dataset.entryId;
      editEntry(entryId);
    });
  });

  document.querySelectorAll(".add-tag-btn").forEach(button => {
    button.addEventListener("click", (e) => {
      const entryId = e.target.dataset.entryId;
      addTagToEntry(entryId);
    });
  });
}

// --- Appliquer les filtres ---
function applyFilters() {
  if (!entriesDiv || !entriesDateTitle) return;
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

// Supprimer une entrée
function deleteEntry(entryId) {
  if (!confirm("Voulez-vous vraiment supprimer cette entrée ?")) return;
  db.collection("entries").doc(entryId).delete()
    .then(() => {
      console.log("Entrée supprimée avec succès.");
    })
    .catch((error) => {
      console.error("Erreur lors de la suppression :", error);
    });
}

// Supprimer un tag d'une entrée
function deleteTag(entryId, tag) {
  const entry = allEntries.find(e => e.id === entryId);
  if (!entry) return;

  const updatedTags = (entry.data.tags || []).filter(t => t !== tag);
  db.collection("entries").doc(entryId).update({ tags: updatedTags })
    .then(() => {
      console.log("Tag supprimé avec succès.");
    })
    .catch((error) => {
      console.error("Erreur lors de la suppression du tag :", error);
    });
}

// Fonction pour modifier une entrée
function editEntry(entryId) {
  const entry = allEntries.find(e => e.id === entryId);
  if (!entry) return;

  // Formater la date pour l'input datetime-local (YYYY-MM-DDTHH:MM)
  const date = entry.data.date ? new Date(entry.data.date) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}`;

  // Créer une fenêtre modale pour l'édition
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Modifier l'entrée</h3>
      <input id="editTitle" value="${entry.data.title || ""}" placeholder="Titre">
      <textarea id="editContent" placeholder="Contenu">${entry.data.content || ""}</textarea>
      <label for="editDate">Date et heure :</label>
      <input id="editDate" type="datetime-local" value="${formattedDate}">
      <div class="modal-actions">
        <button id="saveEdit" class="button-primary">Enregistrer</button>
        <button id="cancelEdit" class="button-secondary">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Gérer l'enregistrement
  document.getElementById("saveEdit").addEventListener("click", () => {
    const newTitle = document.getElementById("editTitle").value.trim();
    const newContent = document.getElementById("editContent").value.trim();
    const newDateInput = document.getElementById("editDate").value;

    const updateData = {
      title: newTitle || "(sans titre)",
      content: newContent || "",
    };

    if (newDateInput) {
      updateData.date = new Date(newDateInput).toISOString();
    }

    db.collection("entries").doc(entryId).update(updateData)
      .then(() => {
        document.body.removeChild(modal);
      })
      .catch((error) => {
        alert("Erreur lors de la mise à jour : " + error.message);
      });
  });

  // Gérer l'annulation
  document.getElementById("cancelEdit").addEventListener("click", () => {
    document.body.removeChild(modal);
  });
}

// Fonction pour ajouter un tag à une entrée existante
function addTagToEntry(entryId) {
  const entry = allEntries.find(e => e.id === entryId);
  if (!entry) return;

  // Créer une fenêtre modale pour ajouter un tag
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Ajouter un tag</h3>
      <input id="newTagInput" placeholder="Nouveau tag" list="existingTags">
      <datalist id="existingTags"></datalist>
      <div class="modal-actions">
        <button id="saveTag" class="button-primary">Ajouter</button>
        <button id="cancelTag" class="button-secondary">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Remplir le datalist avec les tags existants
  const tagSet = new Set();
  allEntries.forEach(e => (e.data.tags || []).forEach(tag => tagSet.add(tag)));
  const datalist = modal.querySelector("#existingTags");
  Array.from(tagSet).sort().forEach(tag => {
    const option = document.createElement("option");
    option.value = tag;
    datalist.appendChild(option);
  });

  // Gérer l'ajout du tag
  modal.querySelector("#saveTag").addEventListener("click", () => {
    const newTag = modal.querySelector("#newTagInput").value.trim();
    if (!newTag) return;

    const currentTags = entry.data.tags || [];
    if (currentTags.includes(newTag)) {
      alert("Ce tag existe déjà pour cette entrée.");
      return;
    }

    db.collection("entries").doc(entryId).update({
      tags: [...currentTags, newTag]
    }).then(() => {
      document.body.removeChild(modal);
    }).catch((error) => {
      alert("Erreur lors de l'ajout du tag : " + error.message);
    });
  });

  // Gérer l'annulation
  modal.querySelector("#cancelTag").addEventListener("click", () => {
    document.body.removeChild(modal);
  });
}

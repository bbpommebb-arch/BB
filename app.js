// app.js - calendrier, tags, responsive, dark mode, privée après login
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener("DOMContentLoaded", () => {

  // --- UI references
  const adminBtn = document.getElementById("adminBtn");
  const loginPopup = document.getElementById("loginPopup");
  const loginCard = document.getElementById("loginCard");
  const closeLogin = document.getElementById("closeLogin");
  const loginBtn = document.getElementById("loginBtn");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  const journalContent = document.getElementById("journalContent");
  const lockedMessage = document.getElementById("lockedMessage");

  const newTitle = document.getElementById("newTitle");
  const newContent = document.getElementById("newContent");
  const newTags = document.getElementById("newTags");
  const addEntryBtn = document.getElementById("addEntryBtn");
  const clearFilters = document.getElementById("clearFilters");

  const allTagsDiv = document.getElementById("allTags");
  const entriesDiv = document.getElementById("entries");
  const countEntries = document.getElementById("countEntries");

  const searchDate = document.getElementById("searchDate");
  const searchText = document.getElementById("searchText");
  const searchBtn = document.getElementById("searchBtn");

  const darkToggle = document.getElementById("darkToggle");

  // --- state
  let calendar = null;
  let currentFilter = { date: null, text: "", tag: null };
  let allEntries = []; // local snapshot {id, data}

  // --- Dark mode init
  function applyDark(pref){
    if(pref) document.body.classList.add("dark");
    else document.body.classList.remove("dark");
  }
  const savedDark = localStorage.getItem("journal-dark") === "1";
  applyDark(savedDark);
  darkToggle.textContent = savedDark ? "☀️" : "🌙";
  darkToggle.addEventListener("click", () => {
    const cur = document.body.classList.toggle("dark");
    localStorage.setItem("journal-dark", cur ? "1" : "0");
    darkToggle.textContent = cur ? "☀️" : "🌙";
  });

  // --- Admin popup
  adminBtn.addEventListener("click", () => { loginPopup.style.display = "flex"; });
  closeLogin.addEventListener("click", () => { loginPopup.style.display = "none"; });

  loginBtn.addEventListener("click", () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if(!email || !password){ alert("Email et mot de passe requis"); return; }
    auth.signInWithEmailAndPassword(email, password)
      .then(()=> { loginPopup.style.display = "none"; })
      .catch(e => alert(e.message));
  });

  // --- Auth state: show/hide journal
  auth.onAuthStateChanged(user => {
    if(user){
      lockedMessage.style.display = "none";
      journalContent.style.display = "block";
      activateEditing();
      startRealtime();
    } else {
      journalContent.style.display = "none";
      lockedMessage.style.display = "block";
      disableEditing();
    }
  });

  // --- Create calendar
  function initCalendar(){
    const calendarEl = document.getElementById("calendar");
    calendarEl.innerHTML = "";
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: window.innerWidth < 700 ? 'dayGridMonth' : 'dayGridMonth',
      height: 450,
      dayMaxEvents: true,
      events: [],
      dateClick: info => {
        // filter by clicked date
        const iso = info.dateStr; // "YYYY-MM-DD"
        currentFilter.date = iso;
        searchDate.value = iso;
        renderEntries();
      }
    });
    calendar.render();
  }
  initCalendar();

  // --- Start listening real time (only when authenticated)
  function startRealtime(){
    db.collection("entries").orderBy("date","desc")
      .onSnapshot(snapshot => {
        allEntries = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));
        // normalize date field (ensure ISO string)
        allEntries.forEach(e => {
          if(e.data.date && typeof e.data.date !== "string" && e.data.date.toDate){
            e.data.date = e.data.date.toDate().toISOString();
          }
        });
        updateUIFromEntries();
      });
  }

  // --- Update UI (calendar events, tags, counts)
  function updateUIFromEntries(){
    // calendar events: mark date with presence and show title counts
    const events = allEntries.map(e => {
      const d = e.data.date ? e.data.date.slice(0,10) : null;
      return { title: e.data.title || "•", start: d, extendedProps: { id: e.id } };
    });
    calendar.removeAllEvents();
    events.forEach(ev => calendar.addEvent(ev));

    // tags pool
    const tagSet = new Set();
    allEntries.forEach(e => {
      const tags = Array.isArray(e.data.tags) ? e.data.tags : [];
      tags.forEach(t => { if(t) tagSet.add(t); });
    });
    renderAllTags(Array.from(tagSet).sort());

    countEntries.textContent = allEntries.length;
    renderEntries();
  }

  // --- Render tag chips
  function renderAllTags(tags){
    allTagsDiv.innerHTML = "";
    tags.forEach(t => {
      const el = document.createElement("button");
      el.className = "tag chipsmall";
      el.textContent = t;
      el.addEventListener("click", () => {
        currentFilter.tag = t;
        renderEntries();
      });
      allTagsDiv.appendChild(el);
    });
  }

  // --- Render entries list with current filters
  function renderEntries(){
    const list = entriesDiv;
    list.innerHTML = "";

    const fDate = currentFilter.date; // ISO YYYY-MM-DD or null
    const fText = (currentFilter.text || "").toLowerCase();
    const fTag = currentFilter.tag;

    const filtered = allEntries.filter(e => {
      const dISO = e.data.date ? e.data.date.slice(0,10) : "";
      if(fDate && dISO !== fDate) return false;
      if(fTag){
        const has = Array.isArray(e.data.tags) && e.data.tags.some(t => t.toLowerCase() === fTag.toLowerCase());
        if(!has) return false;
      }
      if(fText){
        const hay = (e.data.title + " " + e.data.content + " " + (e.data.tags||[]).join(" ")).toLowerCase();
        if(!hay.includes(fText)) return false;
      }
      return true;
    });

    if(filtered.length === 0){
      list.innerHTML = `<div class="small">Aucune entrée pour ces critères.</div>`;
      return;
    }

    filtered.forEach(e => {
      const div = document.createElement("div");
      div.className = "entry";
      const dateStr = e.data.date ? new Date(e.data.date).toLocaleString() : "";
      const tagsHtml = (e.data.tags || []).map(t => `<span class="tag chipsmall">${escapeHtml(t)}</span>`).join(" ");
      div.innerHTML = `
        <div class="meta">
          <div class="title">${escapeHtml(e.data.title || "(sans titre)")}</div>
          <div class="date">${escapeHtml(dateStr)}</div>
        </div>
        <p>${escapeHtml(e.data.content || "")}</p>
        <div class="entry-tags">${tagsHtml}</div>
        <div style="margin-top:8px;">
          <button class="btn-ghost editBtn">Modifier</button>
          <button class="btn-ghost deleteBtn" style="border-color:var(--danger); color:var(--danger)">Supprimer</button>
        </div>
      `;
      // edit
      div.querySelector(".editBtn").addEventListener("click", () => {
        if(!requireAuth()) return;
        // edit title/content/tags
        const newTitle = prompt("Titre :", e.data.title || "");
        if(newTitle === null) return;
        const newContent = prompt("Contenu :", e.data.content || "");
        if(newContent === null) return;
        const newTagsStr = prompt("Tags (séparés par virgule) :", (e.data.tags||[]).join(", "));
        const newTagsArr = newTagsStr ? newTagsStr.split(",").map(t => t.trim()).filter(Boolean) : [];
        db.collection("entries").doc(e.id).update({
          title: newTitle,
          content: newContent,
          tags: newTagsArr
        });
      });
      // delete
      div.querySelector(".deleteBtn").addEventListener("click", () => {
        if(!requireAuth()) return;
        if(confirm("Supprimer cette entrée ?")) db.collection("entries").doc(e.id).delete();
      });

      list.appendChild(div);
    });

    // show editing buttons state depending on auth
    const show = auth.currentUser ? "inline-block" : "none";
    document.querySelectorAll(".editBtn").forEach(b => b.style.display = show);
    document.querySelectorAll(".deleteBtn").forEach(b => b.style.display = show);
  }

  // --- Add entry
  addEntryBtn.addEventListener("click", () => {
    if(!requireAuth()) return;
    const title = newTitle.value.trim();
    const content = newContent.value.trim();
    const tags = (newTags.value || "").split(",").map(t => t.trim()).filter(Boolean);
    if(!title && !content){ alert("Titre ou contenu requis"); return; }
    db.collection("entries").add({
      title: title || "(sans titre)",
      content: content || "",
      tags,
      date: new Date().toISOString()
    }).then(()=> {
      newTitle.value = "";
      newContent.value = "";
      newTags.value = "";
      // reset filters to show recent
      clearFiltersFn();
    });
  });

  // --- Search controls
  searchBtn.addEventListener("click", () => {
    currentFilter.text = searchText.value.trim();
    // date input overrides calendar filter
    currentFilter.date = searchDate.value || null;
    renderEntries();
  });

  clearFilters.addEventListener("click", clearFiltersFn);

  function clearFiltersFn(){
    currentFilter = { date: null, text: "", tag: null };
    searchDate.value = "";
    searchText.value = "";
    renderEntries();
  }

  // --- Auth helpers
  function requireAuth(){
    if(!auth.currentUser){
      alert("Tu dois être connecté (bouton Admin).");
      return false;
    }
    return true;
  }

  function activateEditing(){
    addEntryBtn.disabled = false;
    document.querySelectorAll(".editBtn").forEach(b => b.style.display = "inline-block");
    document.querySelectorAll(".deleteBtn").forEach(b => b.style.display = "inline-block");
  }
  function disableEditing(){
    addEntryBtn.disabled = true;
    document.querySelectorAll(".editBtn").forEach(b => b.style.display = "none");
    document.querySelectorAll(".deleteBtn").forEach(b => b.style.display = "none");
  }

  // --- Utility
  function escapeHtml(str){
    if(!str) return "";
    return String(str)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

}); // DOMContentLoaded end

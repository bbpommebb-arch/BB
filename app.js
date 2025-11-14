const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener("DOMContentLoaded", () => {

  // --- Popup Admin ---
  document.getElementById("adminBtn").addEventListener("click", () => {
    document.getElementById("loginPopup").style.display = "block";
  });

  document.getElementById("closeLogin").addEventListener("click", () => {
    document.getElementById("loginPopup").style.display = "none";
  });

  document.getElementById("loginBtn").addEventListener("click", () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    auth.signInWithEmailAndPassword(email, password)
      .then(() => {
        document.getElementById("loginPopup").style.display = "none";
        alert("Connecté !");
        activateEditing();
      })
      .catch(err => alert(err.message));
  });

  // --- Activer/désactiver l'édition selon l'état ---
  auth.onAuthStateChanged(user => {
    if (user) {
      activateEditing();
    } else {
      disableEditing();
    }
  });

  // --- Ajouter une entrée ---
  document.getElementById("addEntryBtn").addEventListener("click", () => {
    if (!requireAuth()) return;

    const title = document.getElementById("newTitle").value.trim();
    const content = document.getElementById("newContent").value.trim();
    if (!title || !content) { alert("Complète tout"); return; }

    db.collection("entries").add({
      title,
      content,
      date: new Date().toISOString()
    });
    document.getElementById("newTitle").value = "";
    document.getElementById("newContent").value = "";
  });

  // --- Écoute Firestore (live) ---
  db.collection("entries").orderBy("date", "desc").onSnapshot(snapshot => {
    const entriesDiv = document.getElementById("entries");
    entriesDiv.innerHTML = "";

    snapshot.forEach(doc => {
      const data = doc.data();

      const div = document.createElement("div");
      div.className = "entry";

      div.innerHTML = `
        <div class="entry-title">${data.title}</div>
        <div class="entry-date">${new Date(data.date).toLocaleString()}</div>
        <p>${data.content}</p>
        <button class="editBtn">Modifier</button>
        <button class="deleteBtn">Supprimer</button>
      `;

      // Suppression
      div.querySelector(".deleteBtn").addEventListener("click", () => {
        if (!requireAuth()) return;
        if (confirm("Supprimer ?")) db.collection("entries").doc(doc.id).delete();
      });

      // Modification
      div.querySelector(".editBtn").addEventListener("click", () => {
        if (!requireAuth()) return;

        const newTitle = prompt("Nouveau titre :", data.title);
        const newContent = prompt("Nouveau contenu :", data.content);

        if (newTitle && newContent) {
          db.collection("entries").doc(doc.id).update({
            title: newTitle,
            content: newContent
          });
        }
      });

      entriesDiv.appendChild(div);
    });
  });

});


// --- UTILITAIRES ---

function requireAuth() {
  if (!auth.currentUser) {
    alert("Vous devez être connecté (bouton Admin).");
    return false;
  }
  return true;
}

function activateEditing() {
  document.getElementById("addEntryBtn").disabled = false;
  document.querySelectorAll(".editBtn").forEach(btn => btn.style.display = "inline-block");
  document.querySelectorAll(".deleteBtn").forEach(btn => btn.style.display = "inline-block");
}

function disableEditing() {
  document.getElementById("addEntryBtn").disabled = true;
  document.querySelectorAll(".editBtn").forEach(btn => btn.style.display = "none");
  document.querySelectorAll(".deleteBtn").forEach(btn => btn.style.display = "none");
}

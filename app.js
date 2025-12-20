// CONFIGURATION
// Replace 'username' and 'repo' with your actual GitHub details later
const REPO_BASE =
  "https://raw.githubusercontent.com/ArashUnofficial/poems-content/refs/heads/main/";
const INDEX_URL =
  "https://raw.githubusercontent.com/ArashUnofficial/poems-content/refs/heads/main/index.json/";

// DOM ELEMENTS
const homeView = document.getElementById("home-view");
const readerView = document.getElementById("reader-view");
const listContainer = document.getElementById("poem-list");
const notification = document.getElementById("update-notification");
const statusInd = document.getElementById("status-indicator");

// STATE
let db;

// 1. INITIALIZATION
document.addEventListener("DOMContentLoaded", async () => {
  updateOnlineStatus();
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  await initDB();
  await renderLibrary(); // Show what we have locally immediately

  if (navigator.onLine) {
    syncContent(); // Check for updates in background
  }
});

function updateOnlineStatus() {
  if (navigator.onLine) {
    statusInd.textContent = "Online";
    statusInd.className = "online";
  } else {
    statusInd.textContent = "Offline";
    statusInd.className = "offline";
  }
}

// 2. INDEXEDDB SETUP (Raw API)
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("PoemsDB", 1);

    request.onupgradeneeded = (e) => {
      db = e.target.result;
      // Store for list of poems
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      // Store for actual poem content
      if (!db.objectStoreNames.contains("poems")) {
        db.createObjectStore("poems", { keyPath: "id" });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => reject("DB Error");
  });
}

// 3. UI RENDERING
async function renderLibrary() {
  const poems = await getLocalData("meta", "poemList");
  listContainer.innerHTML = "";

  if (!poems || poems.length === 0) {
    listContainer.innerHTML =
      "<p>No poems found. Connect to internet to download.</p>";
    return;
  }

  // Sort by date (newest first)
  poems.sort((a, b) => new Date(b.date) - new Date(a.date));

  poems.forEach((poem) => {
    const card = document.createElement("div");
    card.className = "poem-card";
    card.innerHTML = `<h3>${poem.title}</h3><span>${poem.date}</span>`;
    card.onclick = () => loadPoem(poem.id);
    listContainer.appendChild(card);
  });
}

async function loadPoem(id) {
  const poem = await getLocalData("poems", id);
  if (!poem) {
    alert("Poem content missing. Please sync.");
    return;
  }

  document.getElementById("reader-title").textContent = poem.title;
  document.getElementById("reader-meta").textContent = `${poem.author}`;

  const linesContainer = document.getElementById("reader-lines");
  linesContainer.innerHTML = poem.lines
    .map((line) => `<span class="poem-line">${line}</span>`)
    .join("");

  homeView.classList.add("hidden");
  readerView.classList.remove("hidden");
  window.scrollTo(0, 0);
}

document.getElementById("back-btn").onclick = () => {
  readerView.classList.add("hidden");
  homeView.classList.remove("hidden");
};

document.getElementById("reload-btn").onclick = () => {
  window.location.reload();
};

// 4. SYNC LOGIC (The Core Requirement)
async function syncContent() {
  try {
    console.log("Checking for updates...");

    // Fetch Master Index
    const response = await fetch(INDEX_URL + "?t=" + Date.now()); // Prevent caching
    const cloudIndex = await response.json();

    // Get Local Version
    const localVersionObj = await getLocalData("meta", "version");
    const localVersion = localVersionObj ? localVersionObj.val : 0;

    if (cloudIndex.version > localVersion) {
      console.log(`New version found: ${cloudIndex.version}`);

      // Download all poems listed in index
      // Note: In a huge app, we would diff IDs. For simplicity, we loop all.
      let newCount = 0;

      for (const poemMeta of cloudIndex.poems) {
        // Check if we already have this specific poem?
        // (Optional optimization: Check if ID exists before fetch)
        // For this requirements, we fetch to ensure updates.

        const poemRes = await fetch(REPO_BASE + poemMeta.filename);
        const poemData = await poemRes.json();

        await saveData("poems", poemData);
        newCount++;
      }

      // Update Meta List and Version
      await saveData("meta", { key: "poemList", val: cloudIndex.poems }); // Store pure array wrapped in obj if needed or direct
      // Actually, let's store the list directly but IDB needs valid key path.
      // We'll store: key: 'poemList', value: [array]
      await putData("meta", { key: "poemList", value: cloudIndex.poems });
      await putData("meta", { key: "version", val: cloudIndex.version });

      notification.classList.remove("hidden");
    } else {
      console.log("App is up to date.");
    }
  } catch (err) {
    console.error("Sync failed:", err);
  }
}

// 5. INDEXEDDB HELPERS
function getLocalData(storeName, key) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => {
      // Unpack if it's the meta store special structure
      if (storeName === "meta" && req.result && req.result.value) {
        resolve(req.result.value);
      } else {
        resolve(req.result);
      }
    };
    req.onerror = () => resolve(null);
  });
}

function saveData(storeName, data) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(data);
    tx.oncomplete = () => resolve();
  });
}

function putData(storeName, data) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(data);
    tx.oncomplete = () => resolve();
  });
}

/*************************************************************************
 * Tag-Master Plugin for Premiere Pro (Version Complète et Fonctionnelle)
 *************************************************************************/

const ppro = require("premierepro");

// Variables globales pour les tags
let tags = [];
const tagColors = [
  "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF",
  "#00FFFF", "#FFA500", "#800080", "#A52A2A", "#808080"
];

// Stockage local des tags pour les clips
let clipTags = {};

// Variable globale pour stocker les items du projet
let projectItemsList = [];

// Charger les tags sauvegardés
function loadTags() {
  const savedTags = localStorage.getItem("tagmaster-tags");
  if (savedTags) {
    tags = JSON.parse(savedTags);
    updateTags();
  }
  const savedClipTags = localStorage.getItem("tagmaster-clip-tags");
  if (savedClipTags) {
    clipTags = JSON.parse(savedClipTags);
  }
  console.log("Tags chargés :", tags);
  console.log("Tags des clips chargés :", clipTags);
}

// Sauvegarder les tags
function saveTags() {
  localStorage.setItem("tagmaster-tags", JSON.stringify(tags));
  localStorage.setItem("tagmaster-clip-tags", JSON.stringify(clipTags));
  console.log("Tags sauvegardés.");
}

// Ajouter un tag
function addTag() {
  const tagText = document.getElementById("tagText").value.trim();
  const tagColor = document.getElementById("tagColor").value;

  if (tagText) {
    tags.push({ text: tagText, color: tagColor });
    updateTags();
    saveTags();
    document.getElementById("tagText").value = "";
    log(`Tag "${tagText}" ajouté.`, "#00FF00");
  }
}

// Supprimer un tag
function deleteTag(index) {
  const tagToDelete = tags[index];
  if (!tagToDelete) return;

  tags.splice(index, 1);
  updateTags();
  saveTags();
  log(`Tag "${tagToDelete.text}" supprimé.`, "#FF0000");
}

// Afficher les clips avec un tag spécifique
async function showTagClips(tagText) {
  try {
    log(`=== Clips avec le tag "${tagText}" ===`, "#00FFFF");

    const project = await ppro.Project.getActiveProject();
    if (!project) {
      log("Aucun projet actif.", "red");
      return;
    }

    const projectItems = await project.getProjectItems();
    const clipsWithTag = [];

    for (const item of projectItems) {
      if (item.type === 1) { // Clip
        try {
          const metadata = await item.getMetadata();
          if (metadata && metadata["tag-master"] && metadata["tag-master"].includes(tagText)) {
            clipsWithTag.push(item);
          }
        } catch (error) {
          console.error(`Erreur lecture métadonnées pour ${item.name}:`, error);
        }
      }
    }

    if (clipsWithTag.length === 0) {
      log(`Aucun clip trouvé avec le tag "${tagText}".`, "#FF9900");
    } else {
      log(`Clips avec le tag "${tagText}" (${clipsWithTag.length}) :`, "#00FF00");
      clipsWithTag.forEach((item, i) => {
        log(`  ${i + 1}. ${item.name}`, "#FFFFFF");
      });
    }
  } catch (error) {
    log(`Erreur : ${error.message}`, "red");
    console.error("Erreur dans showTagClips :", error);
  }
}

// Fonction pour lister TOUS les items du projet
async function listProjectItems() {
  try {
    log("=== Liste des éléments du projet ===", "#00FFFF");

    const project = await ppro.Project.getActiveProject();
    if (!project) {
      log("Aucun projet actif trouvé.", "red");
      return;
    }

    log(`Projet : ${project.name}`, "#00FFFF");

    // Tableau pour stocker tous les éléments
    let allItems = [];

    // Méthode 1: Récupérer tous les éléments avec getProjectItems
    if (typeof project.getProjectItems === 'function') {
      try {
        const projectItems = await project.getProjectItems();
        allItems = [...projectItems];
        log(`Éléments racine : ${projectItems.length}`, "#00FF00");

        // Parcourir récursivement les dossiers
        for (const item of projectItems) {
          if (item.type === 2 && typeof item.getChildren === 'function') {
            await collectAllItemsRecursively(item, allItems);
          }
        }
      } catch (error) {
        console.error("Erreur avec getProjectItems :", error);
      }
    }

    // Méthode 2: Si getProjectItems n'a rien donné, essayer getRootProjectItem
    if (allItems.length === 0 && typeof project.getRootProjectItem === 'function') {
      try {
        const rootItem = await project.getRootProjectItem();
        if (rootItem && typeof rootItem.getChildren === 'function') {
          const rootChildren = await rootItem.getChildren();
          allItems = [...rootChildren];
          log(`Éléments racine via getRootProjectItem : ${rootChildren.length}`, "#00FF00");

          for (const item of rootChildren) {
            if (item.type === 2 && typeof item.getChildren === 'function') {
              await collectAllItemsRecursively(item, allItems);
            }
          }
        }
      } catch (error) {
        console.error("Erreur avec getRootProjectItem :", error);
      }
    }

    // Méthode 3: Ajouter les séquences
    if (typeof project.getSequences === 'function') {
      try {
        const sequences = await project.getSequences();
        sequences.forEach(sequence => {
          if (!allItems.some(item => item.name === sequence.name)) {
            allItems.push({
              name: sequence.name,
              type: 3,
              isSequence: true
            });
          }
        });
        log(`Séquences ajoutées : ${sequences.length}`, "#00FF00");
      } catch (error) {
        console.error("Erreur avec getSequences :", error);
      }
    }

    if (allItems.length === 0) {
      log("Aucun élément trouvé.", "#FF9900");
      return;
    }

    log(`Total : ${allItems.length} éléments`, "#00FFFF");
    log("--- Structure ---", "#00FFFF");

    // Afficher la hiérarchie et lire les métadonnées des clips
    for (const item of allItems) {
      if (item.type === 2) {
        await displayProjectItemHierarchy(item, 0);
      } else if (item.type === 1) { // Clip
        let type = "Clip";
        let color = "#00FF00";
        log(`📁 ${item.name} (${type})`, color);
        
        // Lire les métadonnées du clip
        try {
          const metadata = await item.getMetadata();
          if (metadata && metadata["tag-master"]) {
            clipTags[item.name] = metadata["tag-master"];
            log(`  → Tags: ${metadata["tag-master"]}`, "#00FFFF");
          }
        } catch (error) {
          console.error(`Erreur lecture métadonnées pour ${item.name}:`, error);
        }
      } else {
        let type = item.type === 3 ? "Séquence" : "Autre";
        let color = item.type === 3 ? "#2196F3" : "#FFFFFF";
        log(`📁 ${item.name} (${type})`, color);
      }
    }

    // Sauvegarder la liste
    projectItemsList = allItems.map(item => ({
      name: item.name,
      type: item.type || (item.isSequence ? 3 : 0)
    }));
    localStorage.setItem("tagmaster-project-items", JSON.stringify(projectItemsList));
    log(`Liste sauvegardée (${projectItemsList.length} éléments).`, "#00FF00");

  } catch (error) {
    log(`Erreur : ${error.message}`, "red");
    console.error("Erreur dans listProjectItems :", error);
  }
}

// Fonction récursive pour collecter tous les items
async function collectAllItemsRecursively(item, allItems) {
  if (!allItems.some(existing => existing.name === item.name && existing.type === item.type)) {
    allItems.push(item);
  }

  if (item.type === 2 && typeof item.getChildren === 'function') {
    try {
      const children = await item.getChildren();
      for (const child of children) {
        await collectAllItemsRecursively(child, allItems);
      }
    } catch (error) {
      console.error(`Erreur avec getChildren pour ${item.name}:`, error);
    }
  }
}

// Fonction récursive pour afficher la hiérarchie
async function displayProjectItemHierarchy(item, depth) {
  const indent = "  ".repeat(depth);
  let type = item.type === 1 ? "Clip" : item.type === 2 ? "Dossier" : item.type === 3 ? "Séquence" : "Autre";
  let color = item.type === 1 ? "#00FF00" : item.type === 2 ? "#FF9800" : item.type === 3 ? "#2196F3" : "#FFFFFF";
  log(`${indent}📁 ${item.name} (${type})`, color);

  if (item.type === 2 && typeof item.getChildren === 'function') {
    try {
      const children = await item.getChildren();
      for (const child of children) {
        await displayProjectItemHierarchy(child, depth + 1);
      }
    } catch (error) {
      console.error(`Erreur avec getChildren pour ${item.name}:`, error);
    }
  }
}

// Mettre à jour l'affichage des tags
function updateTags() {
  const container = document.getElementById("tagsContainer");
  if (!container) return;

  container.innerHTML = "";
  tags.forEach((tag, index) => {
    const tagContainer = document.createElement("div");
    tagContainer.style.display = "flex";
    tagContainer.style.alignItems = "center";
    tagContainer.style.margin = "4px 0";
    tagContainer.style.gap = "4px";

    // Bouton du tag
    const tagButton = document.createElement("button");
    tagButton.style.backgroundColor = tag.color;
    tagButton.style.color = "white";
    tagButton.style.border = "none";
    tagButton.style.padding = "8px";
    tagButton.style.borderRadius = "4px";
    tagButton.style.cursor = "pointer";
    tagButton.textContent = tag.text;
    tagButton.addEventListener("click", () => applyTagToClips(index));

    // Bouton Supprimer
    const deleteButton = document.createElement("button");
    deleteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19z" fill="white"/></svg>';
    deleteButton.style.backgroundColor = "#FF0000";
    deleteButton.style.padding = "8px";
    deleteButton.style.borderRadius = "4px";
    deleteButton.style.cursor = "pointer";
    deleteButton.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTag(index);
    });

    // Bouton ShowTag
    const showTagButton = document.createElement("button");
    showTagButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="white"/></svg>';
    showTagButton.style.backgroundColor = "#2196F3";
    showTagButton.style.padding = "8px";
    showTagButton.style.borderRadius = "4px";
    showTagButton.style.cursor = "pointer";
    showTagButton.addEventListener("click", (e) => {
      e.stopPropagation();
      showTagClips(tag.text);
    });

    tagContainer.appendChild(tagButton);
    tagContainer.appendChild(deleteButton);
    tagContainer.appendChild(showTagButton);
    container.appendChild(tagContainer);
  });
}

// MÉTHODE 1: sequence.getSelection().getTrackItems()
async function tryMethod1(sequence) {
  if (typeof sequence.getSelection !== 'function') {
    throw new Error("getSelection n'est pas une fonction");
  }
  const selection = sequence.getSelection();
  if (typeof selection.getTrackItems !== 'function') {
    throw new Error("getTrackItems n'est pas une fonction");
  }
  return await selection.getTrackItems();
}

// MÉTHODE 2: ppro.app.getSelection()
async function tryMethod2(sequence, project) {
  if (typeof ppro.app === 'undefined' || typeof ppro.app.getSelection !== 'function') {
    throw new Error("ppro.app.getSelection n'est pas disponible");
  }
  const selection = await ppro.app.getSelection();
  if (!selection || selection.length === 0) {
    throw new Error("Aucune sélection trouvée");
  }
  return selection.filter(item =>
    item && (item.type === "TrackItem" || (item.getProjectItem && typeof item.getProjectItem === 'function'))
  );
}

// MÉTHODE 3: Parcourir les pistes et filtrer les items sélectionnés
async function tryMethod3(sequence) {
  const videoTracks = sequence.videoTracks || [];
  const audioTracks = sequence.audioTracks || [];
  const allTracks = [...videoTracks, ...audioTracks];
  const trackItems = [];

  for (const track of allTracks) {
    if (track && typeof track.getTrackItems === 'function') {
      const items = await track.getTrackItems();
      const selectedItems = items.filter(item =>
        item && (item.isSelected === true || item.selected === true)
      );
      trackItems.push(...selectedItems);
    }
  }

  if (trackItems.length === 0) {
    throw new Error("Aucun clip sélectionné trouvé");
  }
  return trackItems;
}

// MÉTHODE 4: Tous les clips de la séquence (fallback)
async function tryMethod4(sequence) {
  const videoTracks = sequence.videoTracks || [];
  const audioTracks = sequence.audioTracks || [];
  const allTracks = [...videoTracks, ...audioTracks];
  const trackItems = [];

  for (const track of allTracks) {
    if (track && typeof track.getTrackItems === 'function') {
      const items = await track.getTrackItems();
      trackItems.push(...items);
    }
  }

  if (trackItems.length === 0) {
    throw new Error("Aucun clip trouvé dans la séquence");
  }
  return trackItems;
}

// Appliquer le tag aux clips sélectionnés
async function applyTagToClips(index) {
  const selectedTag = tags[index];
  if (!selectedTag) return;

  log(`Application du tag "${selectedTag.text}"...`, "#FFFF00");

  try {
    const project = await ppro.Project.getActiveProject();
    if (!project) {
      log("❌ Aucun projet actif.", "red");
      return;
    }

    const sequence = await project.getActiveSequence();
    if (!sequence) {
      log("❌ Aucune séquence active.", "red");
      return;
    }

    // TABLEAU DES MÉTHODES À ESSAYER (dans l'ordre)
    const methods = [
      { name: "Méthode 1: sequence.getSelection().getTrackItems()", func: tryMethod1 },
      { name: "Méthode 2: ppro.app.getSelection()", func: tryMethod2 },
      { name: "Méthode 3: Parcourir les pistes", func: tryMethod3 },
      { name: "Méthode 4: Tous les clips de la séquence", func: tryMethod4 }
    ];

    let trackItems = [];
    for (const method of methods) {
      try {
        log(`🔍 Essayons : ${method.name}`, "#00FFFF");
        trackItems = await method.func(sequence, project);
        if (trackItems && trackItems.length > 0) {
          log(`✅ ${method.name} a fonctionné (${trackItems.length} clips trouvés)`, "#00FF00");
          break; // On arrête dès qu'une méthode fonctionne
        }
      } catch (error) {
        log(`❌ ${method.name} a échoué: ${error.message}`, "#FF9900");
        console.error(`Erreur ${method.name}:`, error);
      }
    }

    if (trackItems.length === 0) {
      log("❌ Aucune méthode n'a permis de récupérer les clips.", "red");
      return;
    }

    const uniqueClips = new Map();
    for (const trackItem of trackItems) {
      try {
        const projectItem = await trackItem.getProjectItem();
        if (projectItem && !uniqueClips.has(projectItem.name)) {
          uniqueClips.set(projectItem.name, projectItem);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du projectItem:", error);
      }
    }

    if (uniqueClips.size === 0) {
      log("❌ Aucun clip valide trouvé.", "red");
      return;
    }

    for (const [clipName, projectItem] of uniqueClips) {
      let metadata = {};
      try {
        const existingMetadata = await projectItem.getMetadata();
        if (existingMetadata) {
          metadata = existingMetadata;
        }
      } catch (error) {
        console.log("Aucune métadonnée existante, création d'un nouvel objet.");
      }
      
      if (!metadata["tag-master"]) {
        metadata["tag-master"] = "";
      }

      let currentTags = metadata["tag-master"];
      if (!currentTags.includes(selectedTag.text)) {
        const updatedTags = currentTags ? `${currentTags}, ${selectedTag.text}` : selectedTag.text;
        metadata["tag-master"] = updatedTags;

        try {
          await projectItem.setMetadata(metadata);
          clipTags[clipName] = updatedTags;
          log(`✅ Tag ajouté à ${clipName} (métadonnées mises à jour)`, "#00FF00");
        } catch (error) {
          log(`❌ Erreur lors de l'écriture des métadonnées pour ${clipName}: ${error.message}`, "red");
          console.error("Erreur setMetadata:", error);
        }
      } else {
        log(`⚠️ Tag déjà présent pour ${clipName}`, "#FF9900");
      }
    }
    saveTags();
  } catch (error) {
    log(`❌ Erreur principale : ${error.message}`, "red");
    console.error("Erreur complète dans applyTagToClips:", error);
  }
}

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
  console.log("Tag-Master chargé");
  loadTags();

  // Boutons
  const buttonContainer = document.querySelector("#tagsContainer").parentElement;
  if (!buttonContainer) return;

  // Bouton Lister Items Projet
  const btnListItems = document.createElement("button");
  btnListItems.textContent = "Lister Items Projet";
  btnListItems.style.margin = "10px";
  btnListItems.style.padding = "8px";
  btnListItems.style.backgroundColor = "#9C27B0";
  btnListItems.style.color = "#fff";
  btnListItems.style.border = "none";
  btnListItems.style.borderRadius = "4px";
  btnListItems.style.cursor = "pointer";
  btnListItems.addEventListener("click", listProjectItems);
  buttonContainer.appendChild(btnListItems);

  // Bouton Ajouter Tag
  const addTagBtn = document.getElementById("addTagBtn");
  if (addTagBtn) addTagBtn.addEventListener("click", addTag);

  // Bouton Effacer Logs
  const clearBtn = document.querySelector("#clear-btn");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    document.getElementById("plugin-body").innerHTML = "";
  });

  // Gestion du thème
  const currentTheme = document.theme?.getCurrent();
  updateTheme(currentTheme);
  if (document.theme) {
    document.theme.onUpdated.addListener(updateTheme);
  }
});

// Gestion du thème
function updateTheme(theme) {
  const panelBody = document.getElementById("plugin-body");
  const panelHeading = document.getElementById("plugin-heading");
  if (panelBody && panelHeading) {
    if (theme?.includes("dark")) {
      panelBody.style.color = "#fff";
      panelHeading.style.color = "#fff";
      panelBody.style.backgroundColor = "#2d2d2d";
    } else {
      panelBody.style.color = "#000";
      panelHeading.style.color = "#000";
      panelBody.style.backgroundColor = "#f5f5f5";
    }
  }
}

// Fonction de log
function log(msg, color) {
  const pluginBody = document.getElementById("plugin-body");
  if (pluginBody) {
    pluginBody.innerHTML += color ? `<span style='color:${color}'>${msg}</span><br />` : `${msg}<br />`;
  }
}

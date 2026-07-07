/*************************************************************************
 * Tag-Master Plugin for Premiere Pro (Version Officielle pour UXP > 25.0)
 * Basé sur la documentation Adobe UXP :
 * - https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/Project/
 * - https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/ProjectItem/
 * - https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/ProjectItemSelection/
 * - https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/Sequence/
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

// Fonction pour lister TOUS les éléments du projet (UXP > 25.0)
async function AllProjectItems() {
  try {
    // 1. Récupérer le projet actif
    const project = await ppro.Project.getActiveProject();
    if (!project) {
      console.log("❌ Aucun projet actif trouvé.");
      log("❌ Aucun projet actif trouvé.", "red");
      return [];
    }

    console.log(`📂 Projet actif: ${project.name}`);
    log(`📂 Projet actif: ${project.name}`, "#00FFFF");

    // 2. Récupérer l'élément racine du projet avec getRootItem() (méthode officielle pour UXP > 25.0)
    const rootItem = await project.getRootItem();
    if (!rootItem) {
      console.log("❌ Impossible de récupérer l'élément racine du projet.");
      log("❌ Impossible de récupérer l'élément racine du projet.", "red");
      return [];
    }

    console.log(`✅ Élément racine trouvé: ${rootItem.name || 'Projet'}`);
    log(`✅ Élément racine trouvé: ${rootItem.name || 'Projet'}`, "#00FF00");

    // 3. Parcourir récursivement tous les enfants de l'élément racine
    const allItems = [];
    await collectAllItemsRecursively(rootItem, allItems);

    // 4. Sauvegarder la liste globale
    projectItemsList = allItems;
    localStorage.setItem("tagmaster-project-items", JSON.stringify(projectItemsList));

    // 5. Afficher la liste dans les logs du plugin
    log(`=== Liste de tous les éléments du projet (${allItems.length}) ===`, "#00FFFF");
    allItems.forEach((item, index) => {
      const typeName = item.type === 1 ? "Clip" :
                      item.type === 2 ? "Dossier" :
                      item.type === 3 ? "Séquence" : "Autre";
      log(`  ${index + 1}. ID: ${item.id} | Nom: ${item.name} | Type: ${typeName}`, "#FFFFFF");
    });

    return allItems;

  } catch (error) {
    console.error("❌ Erreur dans AllProjectItems:", error);
    log(`❌ Erreur dans AllProjectItems: ${error.message}`, "red");
    return [];
  }
}

// Fonction récursive pour collecter tous les éléments (y compris dans les dossiers)
async function collectAllItemsRecursively(item, allItems) {
  // Éviter les doublons (même ID)
  if (allItems.some(existing => existing.id === item.id)) {
    return;
  }

  // Ajouter l'élément actuel
  allItems.push({
    id: item.id,
    name: item.name,
    type: item.type
  });

  // Si c'est un dossier ou une séquence, parcourir ses enfants
  if ((item.type === 2 || item.type === 3) && typeof item.getChildren === 'function') {
    try {
      const children = await item.getChildren();
      for (const child of children) {
        await collectAllItemsRecursively(child, allItems);
      }
    } catch (error) {
      console.error(`⚠️ Erreur avec getChildren pour ${item.name}:`, error);
    }
  }
}

// Afficher les clips avec un tag spécifique (Version Officielle)
async function showTagClips(tagText) {
  try {
    log(`=== Clips avec le tag "${tagText}" ===`, "#00FFFF");

    // Utiliser AllProjectItems pour récupérer tous les éléments
    const allItems = await AllProjectItems();
    const clipsWithTag = [];

    for (const item of allItems) {
      if (item.type === 1) { // Type 1 = Clip
        try {
          const projectItem = allItems.find(i => i.id === item.id);
          if (projectItem) {
            // Vérifier si le clip a le tag dans ses métadonnées
            const metadata = await projectItem.getMetadata();
            if (metadata?.["tag-master"]?.includes(tagText)) {
              clipsWithTag.push(projectItem);
            }
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

// Fonction pour lister les items du projet (utilise AllProjectItems)
async function listProjectItems() {
  try {
    log("=== Liste des éléments du projet ===", "#00FFFF");
    const allItems = await AllProjectItems();
    
    if (allItems.length === 0) {
      log("Aucun élément trouvé.", "#FF9900");
      return;
    }

    // Charger les tags depuis les métadonnées
    for (const item of allItems) {
      if (item.type === 1) { // Clip
        try {
          const projectItem = allItems.find(i => i.id === item.id);
          if (projectItem) {
            const metadata = await projectItem.getMetadata();
            if (metadata?.["tag-master"]) {
              clipTags[projectItem.name] = metadata["tag-master"];
            }
          }
        } catch (error) {
          console.error(`Erreur lecture métadonnées pour ${item.name}:`, error);
        }
      }
    }

    log(`Total: ${allItems.length} éléments listés.`, "#00FF00");
    return allItems;

  } catch (error) {
    log(`Erreur : ${error.message}`, "red");
    console.error("Erreur dans listProjectItems :", error);
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

// Appliquer le tag aux clips sélectionnés (Version Officielle pour UXP > 25.0)
async function applyTagToClips(index) {
  const selectedTag = tags[index];
  if (!selectedTag) return;

  log(`Application du tag "${selectedTag.text}"...`, "#FFFF00");

  try {
    // 1. Récupérer le projet et la séquence active
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

    log(`🎬 Séquence active: ${sequence.name || 'Sans nom'}`, "#00FFFF");

    // 2. Récupérer la sélection OFFICIELLE (UXP > 25.0)
    let trackItems = [];
    if (typeof sequence.getSelection === 'function') {
      const selection = sequence.getSelection();
      // ✅ selection.trackItems est une PROPRIÉTÉ (pas une méthode !)
      if (selection && Array.isArray(selection.trackItems)) {
        trackItems = selection.trackItems;
        log(`✅ ${trackItems.length} clips sélectionnés (méthode officielle: selection.trackItems)`, "#00FF00");
      }
    }

    // 3. Fallback: Tous les clips de la séquence (si aucun n'est sélectionné)
    if (trackItems.length === 0 && typeof sequence.getTrackItems === 'function') {
      trackItems = await sequence.getTrackItems();
      log(`✅ ${trackItems.length} clips dans la séquence (fallback: sequence.getTrackItems())`, "#00FF00");
    }

    // 4. Fallback ultime: Parcours manuel des pistes de la séquence active
    if (trackItems.length === 0) {
      const videoTracks = sequence.videoTracks || [];
      const audioTracks = sequence.audioTracks || [];
      log(`⚠️ Fallback ultime: Parcours des ${videoTracks.length + audioTracks.length} pistes`, "#FF9900");

      for (const track of [...videoTracks, ...audioTracks]) {
        if (typeof track.getTrackItems === 'function') {
          const items = await track.getTrackItems();
          trackItems.push(...items);
        }
      }
    }

    if (trackItems.length === 0) {
      log("❌ Aucun clip trouvé. Sélectionnez des clips dans la timeline.", "red");
      return;
    }

    // 5. Appliquer le tag aux clips uniques
    const uniqueClips = new Map();
    for (const trackItem of trackItems) {
      try {
        const projectItem = await trackItem.getProjectItem();
        if (projectItem && !uniqueClips.has(projectItem.name)) {
          uniqueClips.set(projectItem.name, projectItem);
        }
      } catch (error) {
        console.error("Erreur getProjectItem:", error);
      }
    }

    if (uniqueClips.size === 0) {
      log("❌ Aucun clip valide trouvé.", "red");
      return;
    }

    // 6. Écrire les métadonnées (méthodes officielles)
    for (const [clipName, projectItem] of uniqueClips) {
      let metadata = await projectItem.getMetadata() || {};
      const currentTags = metadata["tag-master"] || "";
      const updatedTags = currentTags ? `${currentTags}, ${selectedTag.text}` : selectedTag.text;
      metadata["tag-master"] = updatedTags;

      try {
        await projectItem.setMetadata(metadata);
        clipTags[clipName] = updatedTags;
        log(`✅ Tag "${selectedTag.text}" ajouté à ${clipName}`, "#00FF00");
      } catch (error) {
        log(`❌ Erreur setMetadata pour ${clipName}: ${error.message}`, "red");
        console.error("Erreur setMetadata:", error);
      }
    }

    saveTags();
    log("🎉 Tagging terminé!", "#00FFFF");

  } catch (error) {
    log(`❌ Erreur: ${error.message}`, "red");
    console.error("Erreur dans applyTagToClips:", error);
  }
}

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
  console.log("Tag-Master chargé");
  log("Tag-Master chargé", "#00FFFF");
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

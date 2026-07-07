/*************************************************************************
 * Tag-Master Plugin for Premiere Pro (Version avec ProjectUtils.getSelection)
 * Basé sur la documentation officielle Adobe UXP:
 * https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/ProjectUtils/#getselection
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

// Fonction pour lister les éléments sélectionnés dans le panneau Projet
// Utilise ProjectUtils.getSelection() - Méthode officielle Adobe UXP
// Documentation: https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/ProjectUtils/#getselection
async function listSelectedProjectItems() {
  try {
    // 1. Récupérer le projet actif
    const project = await ppro.Project.getActiveProject();
    if (!project) {
      log("❌ Aucun projet actif.", "red");
      return [];
    }

    // 2. Utiliser ProjectUtils.getSelection() (méthode officielle Adobe)
    let selection = [];
    if (typeof ppro.ProjectUtils !== 'undefined' && typeof ppro.ProjectUtils.getSelection === 'function') {
      selection = await ppro.ProjectUtils.getSelection();
      log(`✅ ${selection.length} éléments sélectionnés (ProjectUtils.getSelection).`, "#00FF00");
    }
    // Fallback: ppro.app.getSelection() si ProjectUtils n'est pas disponible
    else if (typeof ppro.app?.getSelection === 'function') {
      selection = await ppro.app.getSelection();
      log(`✅ ${selection.length} éléments sélectionnés (ppro.app.getSelection).`, "#00FF00");
    }

    // 3. Si la sélection existe et n'est pas vide
    if (selection && selection.length > 0) {
      // Retourner les éléments avec id, name, type
      const items = selection.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type
      }));
      
      // Sauvegarder la liste globale
      projectItemsList = items;
      localStorage.setItem("tagmaster-project-items", JSON.stringify(projectItemsList));
      
      // Afficher la liste
      log("=== Ta Sélection ===", "#00FFFF");
      items.forEach((item, index) => {
        const typeName = item.type === 1 ? "Clip" :
                        item.type === 2 ? "Dossier" :
                        item.type === 3 ? "Séquence" : "Autre";
        log(`  ${index + 1}. ID: ${item.id} | Nom: ${item.name} | Type: ${typeName}`, "#FFFFFF");
      });
      
      return items;
    } else {
      log("❌ Aucune sélection trouvée. Sélectionnez des éléments dans le panneau Projet d'abord.", "red");
      return [];
    }

  } catch (error) {
    log(`❌ Erreur: ${error.message}`, "red");
    console.error("Erreur dans listSelectedProjectItems:", error);
    return [];
  }
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

    // Utiliser la liste sauvegardée
    if (projectItemsList.length === 0) {
      log("Aucun élément en mémoire. Utilisez d'abord 'Lister ma Sélection'.", "#FF9900");
      return;
    }

    const clipsWithTag = [];

    for (const item of projectItemsList) {
      if (item.type === 1) { // Type 1 = Clip
        try {
          const projectItem = await project.getProjectItemById(item.id);
          if (projectItem) {
            const metadata = await projectItem.getMetadata();
            if (metadata?.["tag-master"]?.includes(tagText)) {
              clipsWithTag.push(item);
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

    // Utiliser ProjectUtils.getSelection() (méthode officielle Adobe)
    let selection = [];
    if (typeof ppro.ProjectUtils?.getSelection === 'function') {
      selection = await ppro.ProjectUtils.getSelection();
      log(`✅ ${selection.length} éléments sélectionnés (ProjectUtils.getSelection).`, "#00FF00");
    }
    // Fallback: ppro.app.getSelection()
    else if (typeof ppro.app?.getSelection === 'function') {
      selection = await ppro.app.getSelection();
      log(`✅ ${selection.length} éléments sélectionnés (ppro.app.getSelection).`, "#00FF00");
    }

    if (!selection || selection.length === 0) {
      log("❌ Aucune sélection trouvée. Sélectionnez des clips dans le panneau Projet.", "red");
      return;
    }

    // Appliquer le tag aux clips uniques
    const uniqueClips = new Map();
    for (const item of selection) {
      if (item.type === 1) { // Type 1 = Clip
        if (!uniqueClips.has(item.name)) {
          uniqueClips.set(item.name, item);
        }
      }
    }

    if (uniqueClips.size === 0) {
      log("❌ Aucun clip trouvé dans la sélection.", "red");
      return;
    }

    // Écrire les métadonnées
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

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
  console.log("Tag-Master chargé");
  log("Tag-Master chargé", "#00FFFF");
  loadTags();

  // Boutons
  const buttonContainer = document.querySelector("#tagsContainer").parentElement;
  if (!buttonContainer) return;

  // Bouton Lister ma Sélection (utilise ProjectUtils.getSelection)
  const btnListSelected = document.createElement("button");
  btnListSelected.textContent = "Lister ma Sélection";
  btnListSelected.style.margin = "10px";
  btnListSelected.style.padding = "8px";
  btnListSelected.style.backgroundColor = "#2196F3";
  btnListSelected.style.color = "#fff";
  btnListSelected.style.border = "none";
  btnListSelected.style.borderRadius = "4px";
  btnListSelected.style.cursor = "pointer";
  btnListSelected.addEventListener("click", listSelectedProjectItems);
  buttonContainer.appendChild(btnListSelected);

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

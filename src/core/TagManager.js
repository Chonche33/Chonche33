/**
 * Gère la création, suppression et application des tags.
 */
import { Storage } from './Storage.js';
import { PremiereAPI } from './PremiereAPI.js';

export class TagManager {
  /**
   * @param {HTMLElement} tagsContainer - Conteneur DOM pour afficher les tags.
   * @param {Function} log - Fonction pour logger les messages.
   */
  constructor(tagsContainer, log) {
    this.tags = [];
    this.clipTags = {};
    this.tagsContainer = tagsContainer;
    this.log = log;
    this.loadTags();
  }

  /**
   * Charge les tags depuis le stockage local.
   */
  loadTags() {
    const { tags, clipTags } = Storage.loadTags();
    this.tags = tags;
    this.clipTags = clipTags;
    this.renderTags();
    this.log('Tags chargés avec succès.', 'info');
  }

  /**
   * Sauvegarde les tags dans le stockage local.
   */
  saveTags() {
    Storage.saveTags(this.tags, this.clipTags);
    this.log('Tags sauvegardés.', 'success');
  }

  /**
   * Ajoute un nouveau tag.
   * @param {string} name - Nom du tag.
   * @param {string} color - Couleur du tag (hex).
   * @returns {boolean} `true` si le tag a été ajouté.
   */
  addTag(name, color) {
    if (!name.trim()) {
      this.log('Le nom du tag ne peut pas être vide.', 'error');
      return false;
    }

    const existingTag = this.tags.find(tag => tag.name === name);
    if (existingTag) {
      this.log(`Le tag "${name}" existe déjà.`, 'warning');
      return false;
    }

    this.tags.push({ name, color });
    this.saveTags();
    this.renderTags();
    this.log(`Tag "${name}" ajouté.`, 'success');
    return true;
  }

  /**
   * Supprime un tag.
   * @param {number} index - Index du tag à supprimer.
   * @returns {boolean} `true` si le tag a été supprimé.
   */
  deleteTag(index) {
    if (index < 0 || index >= this.tags.length) {
      this.log('Index de tag invalide.', 'error');
      return false;
    }

    const tag = this.tags[index];
    this.tags.splice(index, 1);

    // Supprimer le tag de tous les clips
    for (const clipName in this.clipTags) {
      this.clipTags[clipName] = this.clipTags[clipName].filter(t => t !== tag.name);
    }

    this.saveTags();
    this.renderTags();
    this.log(`Tag "${tag.name}" supprimé.`, 'success');
    return true;
  }

  /**
   * Applique un tag aux clips sélectionnés.
   * @param {number} tagIndex - Index du tag à appliquer.
   */
  async applyTagToClips(tagIndex) {
    const tag = this.tags[tagIndex];
    if (!tag) {
      this.log('Tag introuvable.', 'error');
      return;
    }

    this.log(`Application du tag "${tag.name}"...`, 'info');

    try {
      const clips = await PremiereAPI.getSelectedClips();
      if (clips.length === 0) {
        this.log('Aucun clip sélectionné.', 'warning');
        return;
      }

      // Créer ou récupérer le dossier pour ce tag
      const project = await PremiereAPI.getActiveProject();
      if (!project) {
        this.log('Aucun projet actif.', 'error');
        return;
      }

      const rootItem = await project.getRootProjectItem();
      let tagFolder = await this._getOrCreateTagFolder(rootItem, tag.name);

      if (!tagFolder) {
        this.log(`Impossible de créer le dossier pour le tag "${tag.name}".`, 'error');
        return;
      }

      // Appliquer le tag à chaque clip
      for (const clip of clips) {
        // Ajouter le tag au clip
        if (!this.clipTags[clip.name]) {
          this.clipTags[clip.name] = [];
        }

        if (!this.clipTags[clip.name].includes(tag.name)) {
          this.clipTags[clip.name].push(tag.name);
          this.log(`Tag "${tag.name}" ajouté à "${clip.name}".`, 'success');
        } else {
          this.log(`Tag "${tag.name}" déjà présent pour "${clip.name}".`, 'warning');
        }

        // Déplacer le clip dans le dossier
        const moved = await PremiereAPI.moveClipToFolder(clip, tagFolder);
        if (moved) {
          this.log(`Clip "${clip.name}" déplacé vers "${tag.name}".`, 'success');
        } else {
          this.log(`Échec du déplacement de "${clip.name}".`, 'error');
        }

        // Ajouter un marqueur
        await PremiereAPI.addMarkerToClip(clip, tag.name, tag.color, `Tag: ${tag.name}`);
      }

      this.saveTags();
    } catch (error) {
      this.log(`Erreur: ${error.message}`, 'error');
      console.error('[TagManager] Erreur dans applyTagToClips:', error);
    }
  }

  /**
   * Récupère ou crée un dossier pour un tag.
   * @param {Object} parent - Dossier parent.
   * @param {string} folderName - Nom du dossier.
   * @returns {Promise<Object|null>} Le dossier ou `null`.
   * @private
   */
  async _getOrCreateTagFolder(parent, folderName) {
    try {
      const children = await parent.getChildren();
      const existingFolder = children.find(
        item => item.name === folderName && item.type === 2
      );

      if (existingFolder) return existingFolder;
      return await PremiereAPI.createFolder(parent, folderName);
    } catch (error) {
      console.error(`[TagManager] Erreur dans _getOrCreateTagFolder:`, error);
      return null;
    }
  }

  /**
   * Affiche les clips associés à un tag.
   * @param {string} tagName - Nom du tag.
   */
  showTagClips(tagName) {
    const clips = Object.entries(this.clipTags)
      .filter(([_, tags]) => tags.includes(tagName))
      .map(([clipName]) => clipName);

    if (clips.length === 0) {
      this.log(`Aucun clip trouvé avec le tag "${tagName}".`, 'warning');
    } else {
      this.log(`Clips avec le tag "${tagName}" (${clips.length}):`, 'info');
      clips.forEach((clipName, i) => {
        this.log(`  ${i + 1}. ${clipName}`, 'default');
      });
    }
  }

  /**
   * Met à jour l'affichage des tags dans le DOM.
   */
  renderTags() {
    if (!this.tagsContainer) return;

    this.tagsContainer.innerHTML = '';

    this.tags.forEach((tag, index) => {
      const tagElement = this._createTagElement(tag, index);
      this.tagsContainer.appendChild(tagElement);
    });
  }

  /**
   * Crée un élément DOM pour un tag.
   * @param {Object} tag - Le tag à afficher.
   * @param {number} index - Index du tag.
   * @returns {HTMLElement} Élément DOM du tag.
   * @private
   */
  _createTagElement(tag, index) {
    const tagItem = document.createElement('div');
    tagItem.className = 'tag-item';

    // Bouton du tag
    const tagButton = document.createElement('button');
    tagButton.className = 'tag-button';
    tagButton.style.backgroundColor = tag.color;
    tagButton.textContent = tag.name;
    tagButton.addEventListener('click', () => this.applyTagToClips(index));

    // Bouton de suppression
    const deleteButton = document.createElement('button');
    deleteButton.className = 'tag-delete';
    deleteButton.innerHTML = '✕';
    deleteButton.title = 'Supprimer le tag';
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteTag(index);
    });

    // Bouton pour afficher les clips
    const showButton = document.createElement('button');
    showButton.className = 'tag-delete';
    showButton.innerHTML = '👁️';
    showButton.title = 'Afficher les clips avec ce tag';
    showButton.style.backgroundColor = '#2196F3';
    showButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showTagClips(tag.name);
    });

    tagItem.appendChild(tagButton);
    tagItem.appendChild(showButton);
    tagItem.appendChild(deleteButton);
    return tagItem;
  }
}

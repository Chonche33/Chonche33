/**
 * Gère la récupération et l'affichage des clips du projet.
 */
import { PremiereAPI } from './PremiereAPI.js';
import { Storage } from './Storage.js';

export class ClipManager {
  /**
   * @param {HTMLElement} clipsContainer - Conteneur DOM pour afficher les clips.
   * @param {Function} log - Fonction pour logger les messages.
   * @param {Object} clipTags - Référence vers l'objet `clipTags` du TagManager.
   */
  constructor(clipsContainer, log, clipTags) {
    this.clipsContainer = clipsContainer;
    this.log = log;
    this.clipTags = clipTags;
    this.projectItems = [];
  }

  /**
   * Rafraîchit la liste des clips du projet.
   */
  async refreshClips() {
    this.log('Rafraîchissement des clips...', 'info');

    try {
      const project = await PremiereAPI.getActiveProject();
      if (!project) {
        this.log('Aucun projet actif.', 'error');
        return;
      }

      this.projectItems = await PremiereAPI.getAllProjectItems(project);
      Storage.saveProjectItems(this.projectItems);
      this.renderClips();
      this.log(`${this.projectItems.length} éléments trouvés.`, 'success');
    } catch (error) {
      this.log(`Erreur: ${error.message}`, 'error');
      console.error('[ClipManager] Erreur dans refreshClips:', error);
    }
  }

  /**
   * Organise les clips dans des dossiers par tag.
   */
  async organizeClipsByTags() {
    this.log('Organisation des clips par tags...', 'info');

    try {
      const project = await PremiereAPI.getActiveProject();
      if (!project) {
        this.log('Aucun projet actif.', 'error');
        return;
      }

      const rootItem = await project.getRootProjectItem();
      if (!rootItem) {
        this.log('Impossible de récupérer le dossier racine.', 'error');
        return;
      }

      // Créer un dossier par tag
      for (const tag of Object.keys(this.clipTags)) {
        const tagFolder = await PremiereAPI.createFolder(rootItem, tag);
        if (!tagFolder) {
          this.log(`Impossible de créer le dossier pour le tag "${tag}".`, 'error');
          continue;
        }

        // Déplacer les clips avec ce tag
        for (const clipName of Object.keys(this.clipTags)) {
          if (this.clipTags[clipName].includes(tag)) {
            const clip = this.projectItems.find(item => item.name === clipName);
            if (clip) {
              const moved = await PremiereAPI.moveClipToFolder(clip, tagFolder);
              if (moved) {
                this.log(`Clip "${clipName}" déplacé vers "${tag}".`, 'success');
              } else {
                this.log(`Échec du déplacement de "${clipName}".`, 'error');
              }
            }
          }
        }
      }

      this.log('Organisation terminée.', 'success');
    } catch (error) {
      this.log(`Erreur: ${error.message}`, 'error');
      console.error('[ClipManager] Erreur dans organizeClipsByTags:', error);
    }
  }

  /**
   * Met à jour l'affichage des clips dans le DOM.
   */
  renderClips() {
    if (!this.clipsContainer) return;

    this.clipsContainer.innerHTML = '';

    // Filtrer uniquement les clips (type 1)
    const clips = this.projectItems.filter(item => item.type === 1);

    if (clips.length === 0) {
      this.clipsContainer.innerHTML = '<div class="no-clips">Aucun clip trouvé.</div>';
      return;
    }

    clips.forEach(clip => {
      const clipElement = this._createClipElement(clip);
      this.clipsContainer.appendChild(clipElement);
    });
  }

  /**
   * Crée un élément DOM pour un clip.
   * @param {Object} clip - Le clip à afficher.
   * @returns {HTMLElement} Élément DOM du clip.
   * @private
   */
  _createClipElement(clip) {
    const clipItem = document.createElement('div');
    clipItem.className = 'clip-item';

    const clipName = document.createElement('span');
    clipName.textContent = clip.name;
    clipName.className = 'clip-name';

    const clipTags = document.createElement('div');
    clipTags.className = 'clip-tags';

    // Ajouter les tags du clip
    if (this.clipTags[clip.name] && this.clipTags[clip.name].length > 0) {
      this.clipTags[clip.name].forEach(tagName => {
        const tagElement = document.createElement('span');
        tagElement.className = 'clip-tag';
        tagElement.textContent = tagName;
        // Trouver la couleur du tag
        const tag = this._findTagByName(tagName);
        if (tag) {
          tagElement.style.backgroundColor = tag.color;
        }
        clipTags.appendChild(tagElement);
      });
    } else {
      clipTags.innerHTML = '<span class="no-tags">Aucun tag</span>';
    }

    clipItem.appendChild(clipName);
    clipItem.appendChild(clipTags);
    return clipItem;
  }

  /**
   * Trouve un tag par son nom.
   * @param {string} name - Nom du tag.
   * @returns {Object|null} Le tag ou `null`.
   * @private
   */
  _findTagByName(name) {
    if (!window.tagManager) return null;
    return window.tagManager.tags.find(tag => tag.name === name);
  }
}

/**
 * Gère le stockage local des tags et des associations clip-tag.
 */
export class Storage {
  /**
   * Clés de stockage dans localStorage.
   * @type {Object}
   */
  static STORAGE_KEYS = {
    TAGS: 'tagmaster-tags',
    CLIP_TAGS: 'tagmaster-clip-tags',
    PROJECT_ITEMS: 'tagmaster-project-items'
  };

  /**
   * Charge les tags depuis le stockage local.
   * @returns {Object} { tags: Array, clipTags: Object }
   */
  static loadTags() {
    try {
      const savedTags = localStorage.getItem(this.STORAGE_KEYS.TAGS);
      const savedClipTags = localStorage.getItem(this.STORAGE_KEYS.CLIP_TAGS);

      return {
        tags: savedTags ? JSON.parse(savedTags) : [],
        clipTags: savedClipTags ? JSON.parse(savedClipTags) : {}
      };
    } catch (error) {
      console.error("[Storage] Erreur lors du chargement des tags:", error);
      return { tags: [], clipTags: {} };
    }
  }

  /**
   * Sauvegarde les tags dans le stockage local.
   * @param {Array} tags - Liste des tags.
   * @param {Object} clipTags - Associations clip-tag.
   */
  static saveTags(tags, clipTags) {
    try {
      localStorage.setItem(this.STORAGE_KEYS.TAGS, JSON.stringify(tags));
      localStorage.setItem(this.STORAGE_KEYS.CLIP_TAGS, JSON.stringify(clipTags));
    } catch (error) {
      console.error("[Storage] Erreur lors de la sauvegarde des tags:", error);
    }
  }

  /**
   * Charge la liste des éléments du projet depuis le stockage local.
   * @returns {Array} Liste des éléments du projet.
   */
  static loadProjectItems() {
    try {
      const savedItems = localStorage.getItem(this.STORAGE_KEYS.PROJECT_ITEMS);
      return savedItems ? JSON.parse(savedItems) : [];
    } catch (error) {
      console.error("[Storage] Erreur lors du chargement des éléments du projet:", error);
      return [];
    }
  }

  /**
   * Sauvegarde la liste des éléments du projet dans le stockage local.
   * @param {Array} projectItems - Liste des éléments du projet.
   */
  static saveProjectItems(projectItems) {
    try {
      localStorage.setItem(this.STORAGE_KEYS.PROJECT_ITEMS, JSON.stringify(projectItems));
    } catch (error) {
      console.error("[Storage] Erreur lors de la sauvegarde des éléments du projet:", error);
    }
  }

  /**
   * Exporte les tags et associations sous forme de fichier JSON.
   */
  static exportTags() {
    const { tags, clipTags } = this.loadTags();
    const data = {
      tags,
      clipTags,
      version: '2.0.0',
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `tagmaster-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Importe les tags et associations depuis un fichier JSON.
   * @returns {Promise<void>}
   */
  static async importTags() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
          reject(new Error('Aucun fichier sélectionné.'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            if (data.tags && data.clipTags) {
              this.saveTags(data.tags, data.clipTags);
              resolve();
            } else {
              reject(new Error('Fichier invalide: structure incorrecte.'));
            }
          } catch (error) {
            reject(new Error('Fichier invalide: JSON corrompu.'));
          }
        };

        reader.onerror = () => {
          reject(new Error('Erreur lors de la lecture du fichier.'));
        };

        reader.readAsText(file);
      });

      input.click();
    });
  }
}

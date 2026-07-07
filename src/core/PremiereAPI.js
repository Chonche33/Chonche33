/**
 * Wrapper pour l'API Premiere Pro UXP.
 * Centralise l'accès aux objets Premiere Pro et gère les erreurs.
 */
export class PremiereAPI {
  /**
   * Récupère l'application Premiere Pro.
   * @returns {Promise<Object>} L'objet `app` de Premiere Pro.
   */
  static async getApp() {
    try {
      const app = require('premierepro');
      if (!app) {
        throw new Error("Impossible de charger l'API Premiere Pro.");
      }
      return app;
    } catch (error) {
      console.error("[PremiereAPI] Erreur lors du chargement de l'API:", error);
      throw new Error("API Premiere Pro non disponible.");
    }
  }

  /**
   * Récupère le projet actif.
   * @returns {Promise<Object|null>} Le projet actif ou `null`.
   */
  static async getActiveProject() {
    const app = await this.getApp();
    try {
      return await app.Project.getActiveProject();
    } catch (error) {
      console.error("[PremiereAPI] Erreur lors de la récupération du projet:", error);
      return null;
    }
  }

  /**
   * Récupère la séquence active.
   * @returns {Promise<Object|null>} La séquence active ou `null`.
   */
  static async getActiveSequence() {
    const project = await this.getActiveProject();
    if (!project) return null;

    try {
      return await project.getActiveSequence();
    } catch (error) {
      console.error("[PremiereAPI] Erreur lors de la récupération de la séquence:", error);
      return null;
    }
  }

  /**
   * Récupère tous les éléments du projet (clips, dossiers, séquences).
   * @param {Object} project - Le projet Premiere Pro.
   * @returns {Promise<Array>} Liste des éléments du projet.
   */
  static async getAllProjectItems(project) {
    if (!project) return [];

    try {
      const rootItem = await project.getRootProjectItem();
      if (!rootItem) return [];

      const allItems = [];
      await this._traverseProjectItems(rootItem, allItems);
      return allItems;
    } catch (error) {
      console.error("[PremiereAPI] Erreur lors de la récupération des éléments:", error);
      return [];
    }
  }

  /**
   * Parcourt récursivement les éléments du projet.
   * @param {Object} item - L'élément à parcourir.
   * @param {Array} allItems - Tableau pour stocker les éléments.
   * @private
   */
  static async _traverseProjectItems(item, allItems) {
    if (!item) return;

    // Ajouter l'élément à la liste
    allItems.push(item);

    // Si c'est un dossier, parcourir ses enfants
    if (item.type === 2 && typeof item.getChildren === 'function') {
      try {
        const children = await item.getChildren();
        for (const child of children) {
          await this._traverseProjectItems(child, allItems);
        }
      } catch (error) {
        console.error(`[PremiereAPI] Erreur avec getChildren pour ${item.name}:", error);
      }
    }
  }

  /**
   * Crée un dossier dans le projet.
   * @param {Object} parent - Le dossier parent.
   * @param {string} folderName - Nom du dossier à créer.
   * @returns {Promise<Object|null>} Le dossier créé ou `null`.
   */
  static async createFolder(parent, folderName) {
    if (!parent || !folderName) return null;

    try {
      return await parent.createFolder(folderName);
    } catch (error) {
      console.error(`[PremiereAPI] Erreur lors de la création du dossier "${folderName}":", error);
      return null;
    }
  }

  /**
   * Déplace un clip vers un dossier.
   * @param {Object} clip - Le clip à déplacer.
   * @param {Object} folder - Le dossier de destination.
   * @returns {Promise<boolean>} `true` si le déplacement a réussi.
   */
  static async moveClipToFolder(clip, folder) {
    if (!clip || !folder) return false;

    try {
      await clip.moveTo(folder);
      return true;
    } catch (error) {
      console.error(`[PremiereAPI] Erreur lors du déplacement du clip "${clip.name}":", error);
      return false;
    }
  }

  /**
   * Ajoute un marqueur à un clip.
   * @param {Object} clip - Le clip cible.
   * @param {string} name - Nom du marqueur.
   * @param {string} color - Couleur du marqueur (hex).
   * @param {string} comment - Commentaire du marqueur.
   * @returns {Promise<boolean>} `true` si le marqueur a été ajouté.
   */
  static async addMarkerToClip(clip, name, color, comment) {
    if (!clip || !name) return false;

    try {
      const markers = await clip.getMarkers();
      const existingMarker = markers.find(m =>
        m.comment && m.comment.includes(`[TagMaster] ${name}`)
      );

      if (existingMarker) return false;

      const markerTime = { seconds: 0 }; // Au début du clip
      await clip.createMarker(markerTime, name, color, comment);
      return true;
    } catch (error) {
      console.error(`[PremiereAPI] Erreur lors de l'ajout du marqueur à "${clip.name}":", error);
      return false;
    }
  }

  /**
   * Récupère les clips sélectionnés dans la timeline.
   * @returns {Promise<Array>} Liste des clips sélectionnés.
   */
  static async getSelectedClips() {
    const sequence = await this.getActiveSequence();
    if (!sequence) return [];

    try {
      const trackItems = await sequence.getSelection().getTrackItems();
      const clips = [];

      for (const trackItem of trackItems) {
        try {
          const projectItem = await trackItem.getProjectItem();
          if (projectItem) clips.push(projectItem);
        } catch (error) {
          console.error("[PremiereAPI] Erreur avec getProjectItem:", error);
        }
      }

      return clips;
    } catch (error) {
      console.error("[PremiereAPI] Erreur lors de la récupération des clips sélectionnés:", error);
      return [];
    }
  }
}

/**
 * Point d'entrée principal du plugin Tag Master.
 */
import { PremiereAPI } from './core/PremiereAPI.js';
import { Storage } from './core/Storage.js';
import { TagManager } from './core/TagManager.js';
import { ClipManager } from './core/ClipManager.js';
import { LogConsole } from './ui/LogConsole.js';

/**
 * Application principale Tag Master.
 */
class TagMasterApp {
  constructor() {
    // Éléments DOM
    this.tagsContainer = document.getElementById('tagsContainer');
    this.clipsContainer = document.getElementById('clipsContainer');
    this.logContainer = document.getElementById('logContainer');

    // Initialiser les composants
    this.logConsole = new LogConsole(this.logContainer);
    this.tagManager = new TagManager(this.tagsContainer, this.log.bind(this));
    this.clipManager = new ClipManager(
      this.clipsContainer,
      this.log.bind(this),
      this.tagManager.clipTags
    );

    // Stocker une référence globale pour ClipManager
    window.tagManager = this.tagManager;

    // Initialiser l'application
    this.init();
  }

  /**
   * Initialise l'application.
   */
  init() {
    this.log('🚀 Tag Master initialisé.', 'info');
    this.setupEventListeners();
    this.setupTheme();
  }

  /**
   * Configure les écouteurs d'événements.
   */
  setupEventListeners() {
    // Ajouter un tag
    const addTagBtn = document.getElementById('addTagBtn');
    if (addTagBtn) {
      addTagBtn.addEventListener('click', () => {
        const tagName = document.getElementById('tagName').value.trim();
        const tagColor = document.getElementById('tagColor').value;
        this.tagManager.addTag(tagName, tagColor);
        document.getElementById('tagName').value = '';
      });
    }

    // Rafraîchir les clips
    const refreshClipsBtn = document.getElementById('refreshClipsBtn');
    if (refreshClipsBtn) {
      refreshClipsBtn.addEventListener('click', () => {
        this.clipManager.refreshClips();
      });
    }

    // Organiser les clips
    const organizeClipsBtn = document.getElementById('organizeClipsBtn');
    if (organizeClipsBtn) {
      organizeClipsBtn.addEventListener('click', () => {
        this.clipManager.organizeClipsByTags();
      });
    }

    // Effacer les logs
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', () => {
        this.logConsole.clear();
      });
    }

    // Ajouter un tag avec la touche Entrée
    const tagNameInput = document.getElementById('tagName');
    if (tagNameInput) {
      tagNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addTagBtn.click();
        }
      });
    }

    // Exporter les tags
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Exporter les tags';
    exportBtn.className = 'btn btn-secondary';
    exportBtn.addEventListener('click', () => {
      Storage.exportTags();
      this.log('Tags exportés.', 'success');
    });
    document.querySelector('.tag-form').appendChild(exportBtn);

    // Importer les tags
    const importBtn = document.createElement('button');
    importBtn.textContent = 'Importer les tags';
    importBtn.className = 'btn btn-secondary';
    importBtn.addEventListener('click', async () => {
      try {
        await Storage.importTags();
        this.tagManager.loadTags(); // Recharger les tags
        this.log('Tags importés.', 'success');
      } catch (error) {
        this.log(`Erreur lors de l'import: ${error.message}`, 'error');
      }
    });
    document.querySelector('.tag-form').appendChild(importBtn);

    // Écouteur pour les commandes UXP (raccourcis clavier)
    if (window.__adobe_cep__) {
      window.__adobe_cep__.addEventListener('command', (event) => {
        const commandId = event.data.id;
        if (commandId === 'applyTag1' && this.tagManager.tags.length > 0) {
          this.tagManager.applyTagToClips(0);
        } else if (commandId === 'applyTag2' && this.tagManager.tags.length > 1) {
          this.tagManager.applyTagToClips(1);
        } else if (commandId === 'applyTag3' && this.tagManager.tags.length > 2) {
          this.tagManager.applyTagToClips(2);
        } else if (commandId === 'refreshClips') {
          this.clipManager.refreshClips();
        }
      });
    }
  }

  /**
   * Configure le thème (sombre/clair).
   */
  setupTheme() {
    const currentTheme = document.theme?.getCurrent();
    this.updateTheme(currentTheme);

    if (document.theme) {
      document.theme.onUpdated.addListener((theme) => {
        this.updateTheme(theme);
      });
    }
  }

  /**
   * Met à jour le thème de l'application.
   * @param {Object} theme - Thème actuel.
   */
  updateTheme(theme) {
    const isDark = theme?.includes('dark');
    document.documentElement.style.setProperty(
      '--bg-primary',
      isDark ? '#2a2a2a' : '#f5f5f5'
    );
    document.documentElement.style.setProperty(
      '--bg-secondary',
      isDark ? '#1e1e1e' : '#e0e0e0'
    );
    document.documentElement.style.setProperty(
      '--text-primary',
      isDark ? '#ffffff' : '#000000'
    );
    document.documentElement.style.setProperty(
      '--text-secondary',
      isDark ? '#aaaaaa' : '#666666'
    );
    document.documentElement.style.setProperty(
      '--border-color',
      isDark ? '#555555' : '#cccccc'
    );
  }

  /**
   * Log un message via la console.
   * @param {string} message - Message à logger.
   * @param {string} type - Type de log.
   */
  log(message, type = 'default') {
    this.logConsole.log(message, type);
  }
}

// Initialiser l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
  new TagMasterApp();
});

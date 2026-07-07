/**
 * Gère l'affichage des logs dans la console.
 */
export class LogConsole {
  /**
   * @param {HTMLElement} logContainer - Conteneur DOM pour les logs.
   */
  constructor(logContainer) {
    this.logContainer = logContainer;
  }

  /**
   * Ajoute un message à la console.
   * @param {string} message - Message à afficher.
   * @param {string} type - Type de log ('info', 'success', 'warning', 'error', 'default').
   */
  log(message, type = 'default') {
    if (!this.logContainer) return;

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = message;

    this.logContainer.appendChild(logEntry);
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  /**
   * Efface tous les logs.
   */
  clear() {
    if (this.logContainer) {
      this.logContainer.innerHTML = '';
    }
  }
}

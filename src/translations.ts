export type Language = 'es' | 'en';

export const translations = {
  es: {
    title: "VOLCANO_ESCAPE",
    subtitle: "El suelo es literalmente lava",
    survivor: "Superviviente",
    signOut: "Cerrar Sesión",
    startExpedition: "Iniciar Expedición",
    joinExpedition: "Unirse a Expedición",
    howToPlay: "Cómo Jugar",
    expeditionCode: "Código de Expedición",
    join: "Unirse",
    back: "Volver",
    hallOfFame: "Salón de la Fama",
    noSurvivors: "No hay supervivientes registrados...",
    error: "ERROR",
    camp: "CAMPAMENTO",
    statusGathering: "Estado: Reuniendo equipo",
    explorers: "Exploradores",
    teamRoster: "LISTA_DE_EQUIPO",
    leader: "LÍDER",
    ready: "LISTO",
    departExpedition: "Partir en Expedición",
    waitingLeader: "Esperando al Líder para partir...",
    leaveCamp: "Abandonar Campamento",
    round: "RONDA",
    yourStatus: "TU ESTADO",
    eliminated: "ELIMINADO",
    active: "ACTIVO",
    survivors: "SUPERVIVIENTES",
    chat: "CHAT_DE_EXPEDICIÓN",
    controls: "Controles",
    go: "¡YA!",
    heatIntensifying: "RONDA {round}: EL CALOR SE INTENSIFICA...",
    lavaEruption: "¡ERUPCIÓN DE LAVA! ¡MUÉVETE!",
    specialRound: "!!! RONDA ESPECIAL: LAVA TOTAL !!!",
    thisIsYou: "¡ESTE ERES TÚ!",
    burned: "¡QUEMADO!",
    fellInLava: "Caíste en la lava",
    spectating: "Observando Expedición...",
    expeditionEnd: "FIN_DE_LA_EXPEDICIÓN",
    soleSurvivor: "Único Superviviente",
    noOne: "NADIE",
    newExpedition: "Nueva Expedición",
    returnMenu: "Volver al Menú Principal",
    liveRanking: "RANKING_EN_VIVO",
    survived: "Sobrevivió",
    alive: "VIVO",
    dead: "MUERTO",
    settings: "CONFIGURACIÓN",
    nickname: "Apodo",
    musicVolume: "Volumen de Música",
    sfxVolume: "Volumen de Efectos",
    colorblind: "Daltónico",
    animations: "Animaciones",
    high: "Alta",
    medium: "Media",
    low: "Baja",
    language: "Idioma",
    howToPlayTitle: "REGLAS DE SUPERVIVENCIA",
    rules: {
      objective: {
        title: "El Objetivo",
        desc: "¡Sobrevive a la erupción del volcán! El suelo se convierte en lava periódicamente. Sé el último explorador en pie para ganar."
      },
      safeZones: {
        title: "Zonas Seguras",
        desc: "Algunas celdas pueden tener un escudo 🛡️. Esas zonas son seguras y nunca se convertirán en lava esa ronda."
      },
      lavaRound: {
        title: "Ronda de Lava Total",
        desc: "Cada 5 rondas, ocurre una ronda especial donde gran parte del tablero se vuelve lava rápidamente. ¡Ten cuidado!"
      },
      controls: {
        title: "Controles",
        list: [
          "Usa WASD o las flechas para moverte",
          "Haz click en celdas adyacentes para moverte",
          "Solo puedes moverte un cuadro a la vez"
        ]
      },
      difficulty: {
        title: "Dificultad Progresiva",
        desc: "A medida que pasan las rondas, el tiempo de advertencia disminuye y la cantidad de lava aumenta."
      }
    },
    chatPhrases: [
      "¡Cuidado!",
      "¡Buena suerte!",
      "¡Noooo!",
      "¡Gané!",
      "¡Lava!",
      "¡Ayuda!"
    ],
    gotIt: "¡Entendido!",
    waitingForLeader: "Esperando al Líder para partir...",
    fellIntoLava: "Caíste en la lava",
    returnToMenu: "Volver al Menú Principal",
  },
  en: {
    title: "VOLCANO_ESCAPE",
    subtitle: "The floor is literally lava",
    survivor: "Survivor",
    signOut: "Sign Out",
    startExpedition: "Start Expedition",
    joinExpedition: "Join Expedition",
    howToPlay: "How to Play",
    expeditionCode: "Expedition Code",
    join: "Join",
    back: "Back",
    hallOfFame: "Hall of Fame",
    noSurvivors: "No survivors recorded yet...",
    error: "ERROR",
    camp: "CAMP",
    statusGathering: "Status: Gathering Team",
    explorers: "Explorers",
    teamRoster: "TEAM_ROSTER",
    leader: "LEADER",
    ready: "READY",
    departExpedition: "Depart Expedition",
    waitingLeader: "Waiting for Leader to depart...",
    leaveCamp: "Leave Camp",
    round: "ROUND",
    yourStatus: "YOUR STATUS",
    eliminated: "ELIMINATED",
    active: "ACTIVE",
    survivors: "SURVIVORS",
    chat: "EXPEDITION_CHAT",
    controls: "Controls",
    go: "GO!",
    heatIntensifying: "ROUND {round}: HEAT INTENSIFYING...",
    lavaEruption: "LAVA ERUPTION! MOVE!",
    specialRound: "!!! SPECIAL ROUND: TOTAL LAVA !!!",
    thisIsYou: "THIS IS YOU!",
    burned: "BURNED!",
    fellInLava: "You fell into the lava",
    spectating: "Spectating Expedition...",
    expeditionEnd: "EXPEDITION_END",
    soleSurvivor: "Sole Survivor",
    noOne: "NO ONE",
    newExpedition: "New Expedition",
    returnMenu: "Return to Main Menu",
    liveRanking: "LIVE_RANKING",
    survived: "Survived",
    alive: "ALIVE",
    dead: "DEAD",
    settings: "SETTINGS",
    nickname: "Nickname",
    musicVolume: "Music Volume",
    sfxVolume: "SFX Volume",
    colorblind: "Colorblind",
    animations: "Animations",
    high: "High",
    medium: "Medium",
    low: "Low",
    language: "Language",
    howToPlayTitle: "SURVIVAL RULES",
    rules: {
      objective: {
        title: "The Objective",
        desc: "Survive the volcano eruption! The floor turns into lava periodically. Be the last explorer standing to win."
      },
      safeZones: {
        title: "Safe Zones",
        desc: "Some cells may have a shield 🛡️. These zones are safe and will never turn into lava that round."
      },
      lavaRound: {
        title: "Total Lava Round",
        desc: "Every 5 rounds, a special round occurs where much of the board turns into lava quickly. Be careful!"
      },
      controls: {
        title: "Controls",
        list: [
          "Use WASD or arrow keys to move",
          "Click adjacent cells to move",
          "You can only move one square at a time"
        ]
      },
      difficulty: {
        title: "Progressive Difficulty",
        desc: "As rounds pass, warning time decreases and lava amount increases."
      }
    },
    chatPhrases: [
      "Watch out!",
      "Good luck!",
      "Noooo!",
      "I won!",
      "Lava!",
      "Help!"
    ],
    gotIt: "Understood!",
    waitingForLeader: "Waiting for Leader to depart...",
    fellIntoLava: "You fell into the lava",
    returnToMenu: "Return to Main Menu",
  }
};

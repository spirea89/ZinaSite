(function () {
  const supported = ['ro', 'en', 'de'];
  let enabled = ['ro', 'de'];
  const saved = localStorage.getItem('zina-language');
  const browserLanguage = (navigator.language || 'ro').slice(0, 2);
  const locale = enabled.includes(saved) ? saved : (enabled.includes(browserLanguage) ? browserLanguage : 'ro');

  const messages = {
    ro: {
      about: 'Despre noi', team: 'Echipă', articles: 'Proiecte', events: 'Evenimente', resources: 'Resurse', admin: 'Admin',
      resourcesTitle: 'Resurse', resourcesDescription: 'Activități și instrumente utile pentru familiile comunității', familyGames: 'Jocuri pentru familie', languageRoulette: 'Language Roulette', languageRouletteDescription: 'Un joc interactiv pentru familii care exersează limba germană prin întrebări, răspunsuri și o roată a norocului.', playLanguageRoulette: 'Joacă Language Roulette →',
      teamTitle: 'Echipa noastră', teamDescription: 'Oamenii care au fondat și construiesc comunitatea ZinA', noTeam: 'Profilurile echipei vor apărea aici în curând.',
      articlesTitle: 'Proiecte', articlesDescription: 'Inițiative și proiecte pentru comunitatea română din Viena',
      noArticles: 'Nu există proiecte publicate încă.', readMore: 'Vezi proiectul →', allCategories: 'Toate categoriile',
      eventsTitle: 'Evenimente', eventsDescription: 'Întâlniri și evenimente ale comunității române din Viena',
      noEvents: 'Nu există evenimente publicate încă.', details: 'Vezi detalii →', upcoming: 'Evenimente viitoare', past: 'Evenimente trecute',
      backArticles: 'Înapoi la proiecte', backEvents: 'Înapoi la evenimente', loading: 'Se încarcă…',
      articleMissing: 'Proiectul nu a fost găsit.', eventMissing: 'Evenimentul nu a fost găsit.',
      location: 'Locație', register: 'Înscriere', registerButton: 'Înscrie-te la eveniment',
      footer: 'Comunitatea românilor din Viena', previous: '← Anterior', next: 'Următor →'
    },
    en: {
      about: 'About us', team: 'Team', articles: 'Projects', events: 'Events', resources: 'Resources', admin: 'Admin',
      resourcesTitle: 'Resources', resourcesDescription: 'Useful activities and tools for families in our community', familyGames: 'Family Games', languageRoulette: 'Language Roulette', languageRouletteDescription: 'An interactive family game for practising German through questions, answers and a spinning wheel.', playLanguageRoulette: 'Play Language Roulette →',
      teamTitle: 'Our team', teamDescription: 'The people who founded and continue to build the ZinA community', noTeam: 'Team profiles will appear here soon.',
      articlesTitle: 'Projects', articlesDescription: 'Initiatives and projects for Vienna’s Romanian community',
      noArticles: 'No projects have been published yet.', readMore: 'View project →', allCategories: 'All categories',
      eventsTitle: 'Events', eventsDescription: 'Gatherings and events for Vienna’s Romanian community',
      noEvents: 'No events have been published yet.', details: 'View details →', upcoming: 'Upcoming events', past: 'Past events',
      backArticles: 'Back to projects', backEvents: 'Back to events', loading: 'Loading…',
      articleMissing: 'The project could not be found.', eventMissing: 'The event could not be found.',
      location: 'Location', register: 'Registration', registerButton: 'Register for this event',
      footer: 'The Romanian community in Vienna', previous: '← Previous', next: 'Next →'
    },
    de: {
      about: 'Über uns', team: 'Team', articles: 'Projekte', events: 'Veranstaltungen', resources: 'Ressourcen', admin: 'Admin',
      resourcesTitle: 'Ressourcen', resourcesDescription: 'Hilfreiche Aktivitäten und Werkzeuge für Familien in unserer Gemeinschaft', familyGames: 'Familienspiele', languageRoulette: 'Language Roulette', languageRouletteDescription: 'Ein interaktives Familienspiel, um Deutsch mit Fragen, Antworten und einem Glücksrad zu üben.', playLanguageRoulette: 'Language Roulette spielen →',
      teamTitle: 'Unser Team', teamDescription: 'Die Menschen, die die ZinA-Gemeinschaft gegründet haben und weiter aufbauen', noTeam: 'Die Teamprofile erscheinen hier in Kürze.',
      articlesTitle: 'Projekte', articlesDescription: 'Initiativen und Projekte für die rumänische Gemeinschaft in Wien',
      noArticles: 'Noch keine Projekte veröffentlicht.', readMore: 'Projekt ansehen →', allCategories: 'Alle Kategorien',
      eventsTitle: 'Veranstaltungen', eventsDescription: 'Treffen und Veranstaltungen der rumänischen Gemeinschaft in Wien',
      noEvents: 'Noch keine Veranstaltungen veröffentlicht.', details: 'Details ansehen →', upcoming: 'Kommende Veranstaltungen', past: 'Vergangene Veranstaltungen',
      backArticles: 'Zurück zu den Projekten', backEvents: 'Zurück zu den Veranstaltungen', loading: 'Wird geladen…',
      articleMissing: 'Das Projekt wurde nicht gefunden.', eventMissing: 'Die Veranstaltung wurde nicht gefunden.',
      location: 'Ort', register: 'Anmeldung', registerButton: 'Zur Veranstaltung anmelden',
      footer: 'Die rumänische Gemeinschaft in Wien', previous: '← Zurück', next: 'Weiter →'
    }
  };

  const homepage = {
    en: {
      navAbout:'About us',navArticles:'Projects',navEvents:'Events',heroEyebrow:'Romanian roots · Together in Vienna',heroTitle:'Here, you can feel',heroTitleAccent:'at home.',
      heroLead:'A safe and welcoming place for Romanians in Vienna. We meet, help one another and keep close the things that connect us to home.',heroPrimaryButton:'Join the next gathering',heroSecondaryButton:'Discover the community',welcomeTitle:'You are welcome.',welcomeText:'Whether you arrived yesterday or Vienna has been your home for years.',heroCaption:'Home is not only a place. It is the people who welcome you.',missionKicker:'Why we are here',missionTitleLine1:'Closer to one another.',missionTitleLine2:'Closer to home.',missionDescription:'ZinA builds a community where you can ask for help, make friends and share the joy of being Romanian — wherever life takes you.',pillar1Label:'Cultural events',pillar1Title:'We gather around the table',pillar1Text:'Meetings, celebrations and community evenings where traditions come alive again.',pillar2Label:'People nearby',pillar2Title:'You do not have to be alone',pillar2Text:'Friendship, mentoring and genuine connections for every new beginning in Vienna.',pillar3Label:'Trusted support',pillar3Title:'We find the way together',pillar3Text:'Local information and useful resources, explained patiently for families, students and newcomers.',discoverTitle:'Discover more',discoverDescription:'Community projects and events in Vienna',articlesCardTitle:'Projects',articlesCardText:'Initiatives and projects for Romanians in Vienna',articlesCardLink:'View projects →',eventsCardTitle:'Events',eventsCardText:'Meetings, celebrations and community events',eventsCardLink:'View events →',footerMain:'ZusammenInAustria (ZinA) • Vienna, Austria',footerSubtitle:'The Romanian community in Vienna'
    },
    de: {
      navAbout:'Über uns',navArticles:'Projekte',navEvents:'Veranstaltungen',heroEyebrow:'Rumänische Wurzeln · Gemeinsam in Wien',heroTitle:'Hier kannst du dich',heroTitleAccent:'zu Hause fühlen.',heroLead:'Ein sicherer und herzlicher Ort für Rumäninnen und Rumänen in Wien. Wir treffen uns, helfen einander und bewahren die Verbindung zur Heimat.',heroPrimaryButton:'Komm zum nächsten Treffen',heroSecondaryButton:'Entdecke die Gemeinschaft',welcomeTitle:'Du bist willkommen.',welcomeText:'Ob du gestern angekommen bist oder Wien seit Jahren dein Zuhause ist.',heroCaption:'Zuhause ist nicht nur ein Ort. Es sind die Menschen, die dich willkommen heißen.',missionKicker:'Warum wir hier sind',missionTitleLine1:'Einander näher.',missionTitleLine2:'Der Heimat näher.',missionDescription:'ZinA schafft eine Gemeinschaft, in der du um Hilfe bitten, Freundschaften schließen und die Freude am Rumänischsein teilen kannst — wohin das Leben dich auch führt.',pillar1Label:'Kulturelle Veranstaltungen',pillar1Title:'Wir kommen am Tisch zusammen',pillar1Text:'Treffen, Feste und Gemeinschaftsabende, an denen Traditionen wieder lebendig werden.',pillar2Label:'Menschen in deiner Nähe',pillar2Title:'Du musst nicht allein sein',pillar2Text:'Freundschaft, Mentoring und echte Verbindungen für jeden Neuanfang in Wien.',pillar3Label:'Verlässliche Unterstützung',pillar3Title:'Gemeinsam finden wir den Weg',pillar3Text:'Lokale Informationen und hilfreiche Ressourcen, verständlich erklärt für Familien, Studierende und Neuankömmlinge.',discoverTitle:'Mehr entdecken',discoverDescription:'Projekte und Veranstaltungen der Gemeinschaft in Wien',articlesCardTitle:'Projekte',articlesCardText:'Initiativen und Projekte für Rumäninnen und Rumänen in Wien',articlesCardLink:'Projekte ansehen →',eventsCardTitle:'Veranstaltungen',eventsCardText:'Treffen, Feste und Veranstaltungen der Gemeinschaft',eventsCardLink:'Veranstaltungen ansehen →',footerMain:'ZusammenInAustria (ZinA) • Wien, Österreich',footerSubtitle:'Die rumänische Gemeinschaft in Wien'
    }
  };

  function t(key) { return messages[locale][key] || messages.ro[key] || key; }
  function categoryName(category) { return category ? (category[`name_${locale}`] || category.name_ro || '') : ''; }
  function localizeArticle(article) {
    if (locale === 'en') return { ...article, title: article.titleEn || article.title, content: article.contentEn || article.content };
    if (locale === 'de') return { ...article, title: article.titleDe || article.title, content: article.contentDe || article.content };
    return article;
  }
  function localizeEvent(event) {
    if (locale === 'en') return { ...event, title: event.titleEn || event.title, description: event.descriptionEn || event.description };
    if (locale === 'de') return { ...event, title: event.titleDe || event.title, description: event.descriptionDe || event.description };
    return event;
  }
  function apply() {
    document.documentElement.lang = locale;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  }
  function applyHomepage() {
    if (locale === 'ro') return;
    Object.entries(homepage[locale] || {}).forEach(([field, value]) => {
      const el = document.querySelector(`[data-home-field="${field}"]`);
      if (el) el.textContent = value;
    });
  }
  function addSwitcher() {
    const nav = document.querySelector('.nav-links');
    if (!nav) return;
    const existing = nav.querySelector('.language-switcher');
    const wrap = existing || document.createElement('div');
    wrap.replaceChildren();
    wrap.className = 'language-switcher';
    wrap.setAttribute('aria-label', 'Language');
    enabled.forEach(code => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = code.toUpperCase();
      button.className = code === locale ? 'active' : '';
      button.setAttribute('aria-pressed', String(code === locale));
      button.addEventListener('click', () => { localStorage.setItem('zina-language', code); location.reload(); });
      wrap.appendChild(button);
    });
    if (!existing) {
      const admin = nav.querySelector('.admin-link');
      nav.insertBefore(wrap, admin || null);
    }
  }

  function setLanguageSettings(settings) {
    enabled = ['ro'];
    if (!settings || settings.de !== false) enabled.push('de');
    if (settings && settings.en === true) enabled.push('en');
    if (!enabled.includes(locale)) {
      localStorage.setItem('zina-language', 'ro');
      location.reload();
      return;
    }
    addSwitcher();
  }

  function homepageContent(language = locale) { return { ...(homepage[language] || {}) }; }

  const legacyProjectText = {
    ro: {
      navArticles: ['Articole', 'Proiecte'],
      discoverDescription: ['Articole pentru comunitate și evenimente în Viena', 'Proiecte pentru comunitate și evenimente în Viena'],
      articlesCardTitle: ['Articole', 'Proiecte'],
      articlesCardText: ['Știri, sfaturi și resurse pentru românii din Viena', 'Inițiative și proiecte pentru românii din Viena'],
      articlesCardLink: ['Vezi articole →', 'Vezi proiectele →']
    },
    en: {
      navArticles: ['Articles', 'Projects'],
      discoverDescription: ['Community articles and events in Vienna', 'Community projects and events in Vienna'],
      articlesCardTitle: ['Articles', 'Projects'],
      articlesCardText: ['News, guidance and resources for Romanians in Vienna', 'Initiatives and projects for Romanians in Vienna'],
      articlesCardLink: ['View articles →', 'View projects →']
    },
    de: {
      navArticles: ['Artikel', 'Projekte'],
      discoverDescription: ['Artikel und Veranstaltungen der Gemeinschaft in Wien', 'Projekte und Veranstaltungen der Gemeinschaft in Wien'],
      articlesCardTitle: ['Artikel', 'Projekte'],
      articlesCardText: ['Neuigkeiten, Tipps und Ressourcen für Rumäninnen und Rumänen in Wien', 'Initiativen und Projekte für Rumäninnen und Rumänen in Wien'],
      articlesCardLink: ['Artikel ansehen →', 'Projekte ansehen →']
    }
  };

  function normalizeHomepageContent(value, language = locale) {
    const normalized = { ...(value || {}) };
    Object.entries(legacyProjectText[language] || {}).forEach(([field, pair]) => {
      if (normalized[field] === pair[0]) normalized[field] = pair[1];
    });
    return normalized;
  }

  window.I18n = { locale, t, apply, applyHomepage, homepageContent, normalizeHomepageContent, categoryName, localizeArticle, localizeEvent, setLanguageSettings };
  document.addEventListener('DOMContentLoaded', () => { apply(); addSwitcher(); });
})();

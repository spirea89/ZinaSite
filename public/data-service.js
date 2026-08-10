(function (root) {
  'use strict';

  const isAdminPage = root.location.pathname.includes('admin');

  function provider() {
    const config = root.ZinaConfig.get();
    if (config.backendProvider !== 'google-apps-script') throw new Error('Google Apps Script is the only supported ZiNa backend.');
    if (!root.GoogleAppsScriptProvider) throw new Error('Google Apps Script provider is not loaded.');
    return root.GoogleAppsScriptProvider;
  }

  const DataService = {
    ensureInitialized: () => provider().ensureConfigured(),
    getArticles: status => provider().getArticles(status),
    getArticlesPage: (page, pageSize) => provider().getArticlesPage(page, pageSize),
    getAllArticles: () => provider().getAllArticles(),
    createArticle: article => provider().createArticle(article),
    updateArticle: (id, article) => provider().updateArticle(id, article),
    deleteArticle: id => provider().deleteArticle(id),
    setArticleStatus: (id, status) => provider().setArticleStatus(id, status),
    getEvents: status => provider().getEvents(status),
    getEventsPage: (page, pageSize) => provider().getEventsPage(page, pageSize),
    getAllEvents: () => provider().getAllEvents(),
    createEvent: event => provider().createEvent(event),
    updateEvent: (id, event) => provider().updateEvent(id, event),
    deleteEvent: id => provider().deleteEvent(id),
    setEventStatus: (id, status) => provider().setEventStatus(id, status),
    getTeamMembers: () => provider().getTeamMembers(isAdminPage),
    createTeamMember: member => provider().createTeamMember(member),
    updateTeamMember: (id, member) => provider().updateTeamMember(id, member),
    deleteTeamMember: id => provider().deleteTeamMember(id),
    updateTeamMemberSortOrder: (id, sortOrder) => provider().updateTeamMemberSortOrder(id, sortOrder),
    uploadTeamImage: async file => (await provider().uploadMedia(file, { usage: 'team', entityType: 'team' })).publicUrl,
    getCategories: () => provider().getCategories(isAdminPage),
    createCategory: category => provider().createCategory(category),
    updateCategory: (id, category) => provider().updateCategory(id, category),
    deleteCategory: id => provider().deleteCategory(id),
    getHomepageContent: () => provider().getHomepageContent(isAdminPage),
    updateHomepageContent: (content, heroImageUrl, heroImagePosition) => provider().updateHomepageContent(content, heroImageUrl, heroImagePosition),
    uploadHomepageImage: async file => (await provider().uploadMedia(file, { usage: 'homepage', entityType: 'homepage' })).publicUrl
  };

  root.DataService = Object.freeze(DataService);
})(window);

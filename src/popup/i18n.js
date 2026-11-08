let i18nDictionary = null;

function t(id, fallback) {
    if (i18nDictionary && typeof i18nDictionary[id] === 'string') {
        return i18nDictionary[id];
    }
    const msg = chrome.i18n.getMessage(id);
    return (msg || fallback || '');
}

function loadLanguageDictionary(language) {
    if (language === 'auto') {
        i18nDictionary = null;
        return Promise.resolve();
    }
    return fetch(chrome.runtime.getURL(`_locales/${language}/messages.json`))
        .then(res => res.json())
        .then(data => {
            i18nDictionary = {};
            Object.keys(data).forEach(key => {
                i18nDictionary[key] = data[key].message;
            });
        })
        .catch(err => {
            console.error('[Roomy] Failed to load language dictionary:', language, err);
            i18nDictionary = null;
        });
}

function localizeHtmlPage() {
    document.documentElement.lang = t('localeCode', 'en');
    document.querySelectorAll('[data-i18n]').forEach(element => {
        element.textContent = t(element.dataset.i18n, element.textContent);
    });
    document.querySelectorAll('[data-i18n-label]').forEach(element => {
        element.setAttribute('aria-label', t(element.dataset.i18nLabel, element.getAttribute('aria-label')));
    });
}

function fillTemplate(template, values) {
    return Object.keys(values).reduce((text, key) => text.split(`{${key}}`).join(values[key]), template);
}

function formatSites(names) {
    return window.widerRoomySites.joinNames(names, t('localeCode', 'en'));
}

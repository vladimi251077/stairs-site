(function () {
  'use strict';

  const FIRST_TOUCH_KEY = 'tekstura_lead_first_touch';
  const LAST_TOUCH_KEY = 'tekstura_lead_last_touch';
  const CLICKED_EVENT_KEY = 'tekstura_lead_clicked_event';
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  function storageGet(storage, key) {
    try {
      const value = storage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  function storageSet(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Tracking must never block navigation or lead submission.
    }
  }

  function currentTouch() {
    const params = new URLSearchParams(window.location.search);
    const touch = {
      page: window.location.pathname + window.location.search,
      referrer: document.referrer || '',
      captured_at: new Date().toISOString()
    };
    UTM_KEYS.forEach(function (key) {
      touch[key] = params.get(key) || '';
    });
    return touch;
  }

  const touch = currentTouch();
  const firstTouch = storageGet(window.localStorage, FIRST_TOUCH_KEY) || touch;
  if (!storageGet(window.localStorage, FIRST_TOUCH_KEY)) {
    storageSet(window.localStorage, FIRST_TOUCH_KEY, firstTouch);
  }
  const previousLastTouch = storageGet(window.sessionStorage, LAST_TOUCH_KEY) || {};
  UTM_KEYS.forEach(function (key) {
    touch[key] = touch[key] || previousLastTouch[key] || '';
  });
  storageSet(window.sessionStorage, LAST_TOUCH_KEY, touch);

  function getClickedEvent() {
    try {
      return window.sessionStorage.getItem(CLICKED_EVENT_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function track(eventName, details) {
    const event = String(eventName || '').trim();
    if (!event) return;
    try {
      window.sessionStorage.setItem(CLICKED_EVENT_KEY, event);
    } catch (error) {
      // Continue without persistence when storage is unavailable.
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.debug('[lead-tracker]', event, details || {});
    }
    document.dispatchEvent(new CustomEvent('lead:track', {
      detail: { event: event, details: details || {}, tracking: getTrackingData() }
    }));
  }

  function getTrackingData() {
    const first = storageGet(window.localStorage, FIRST_TOUCH_KEY) || firstTouch;
    const last = storageGet(window.sessionStorage, LAST_TOUCH_KEY) || touch;
    return {
      lead_page: last.page || '',
      lead_referrer: last.referrer || '',
      lead_utm_source: last.utm_source || '',
      lead_utm_medium: last.utm_medium || '',
      lead_utm_campaign: last.utm_campaign || '',
      lead_utm_content: last.utm_content || '',
      lead_utm_term: last.utm_term || '',
      lead_first_page: first.page || '',
      lead_first_referrer: first.referrer || '',
      lead_clicked_event: getClickedEvent()
    };
  }

  function populateHiddenFields() {
    const data = getTrackingData();
    Object.keys(data).forEach(function (name) {
      const field = document.querySelector('[name="' + name + '"]');
      if (field) field.value = data[name];
    });
  }

  function addWhatsAppContext(link) {
    if (!link || !/^https:\/\/(?:www\.)?wa\.me\//i.test(link.href)) return;
    try {
      const url = new URL(link.href);
      if (url.searchParams.has('text')) return;
      url.searchParams.set('text', 'Здравствуйте, хочу расчёт лестницы. Страница: ' + window.location.pathname);
      link.href = url.toString();
    } catch (error) {
      // Keep the original link if its URL cannot be parsed safely.
    }
  }

  document.addEventListener('click', function (event) {
    const target = event.target.closest('[data-lead-event]');
    if (!target) return;
    addWhatsAppContext(target);
    track(target.dataset.leadEvent, {
      source: target.dataset.leadSource || '',
      location: target.dataset.leadLocation || '',
      href: target.getAttribute('href') || ''
    });
    populateHiddenFields();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', populateHiddenFields, { once: true });
  } else {
    populateHiddenFields();
  }

  window.LeadTracker = Object.freeze({
    getTrackingData: getTrackingData,
    populateHiddenFields: populateHiddenFields,
    track: track
  });
})();

(function () {
  const allowedModes = new Set(['production', 'maintenance', 'preview']);

  window.TEKSTURA_CALCULATOR_CONFIG = {
    mode: 'production',
    contacts: {
      requestUrl: '/request.html',
      // TODO: replace with real Tekstura WhatsApp/Telegram contact before enabling maintenance publicly.
      whatsappUrl: '',
      telegramUrl: ''
    }
  };

  window.TEKSTURA_CALCULATOR_CONFIG_READY = fetch('/content/site.json', { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('Calculator settings request failed');
      return response.json();
    })
    .then(function (settings) {
      window.TEKSTURA_CALCULATOR_CONFIG.mode = allowedModes.has(settings.calculator_mode)
        ? settings.calculator_mode
        : 'production';
      return window.TEKSTURA_CALCULATOR_CONFIG;
    })
    .catch(function () {
      window.TEKSTURA_CALCULATOR_CONFIG.mode = 'production';
      return window.TEKSTURA_CALCULATOR_CONFIG;
    });
})();

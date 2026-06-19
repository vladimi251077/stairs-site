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

  window.TEKSTURA_CALCULATOR_CONFIG_READY = (async function () {
    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
      controller.abort();
    }, 5000);

    try {
      const supabaseConfig = window.SUPABASE_CONFIG;
      if (!supabaseConfig?.url || !supabaseConfig?.anonKey) {
        throw new Error('Supabase config is missing');
      }

      const endpoint = supabaseConfig.url.replace(/\/$/, '')
        + '/rest/v1/settings?id=eq.1&select=calculator_mode';
      const response = await fetch(endpoint, {
        cache: 'no-store',
        headers: {
          apikey: supabaseConfig.anonKey,
          Authorization: 'Bearer ' + supabaseConfig.anonKey
        },
        signal: controller.signal
      });

      if (!response.ok) throw new Error('Calculator settings request failed');
      const rows = await response.json();
      const configuredMode = Array.isArray(rows) ? rows[0]?.calculator_mode : null;
      window.TEKSTURA_CALCULATOR_CONFIG.mode = allowedModes.has(configuredMode)
        ? configuredMode
        : 'production';
    } catch (error) {
      window.TEKSTURA_CALCULATOR_CONFIG.mode = 'production';
    } finally {
      clearTimeout(timeoutId);
    }

    return window.TEKSTURA_CALCULATOR_CONFIG;
  })();
})();

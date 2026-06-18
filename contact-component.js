(function () {
  const fallbackContacts = {
    phone: '+79376154136',
    whatsapp: '+79376154136',
    telegram: '+79376154136',
    email: ''
  };

  function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function normalizePhoneHref(value) {
    const digits = digitsOnly(value);
    return digits ? 'tel:+' + digits : '';
  }

  function formatPhoneLabel(value) {
    const digits = digitsOnly(value);
    if (digits.length === 11 && digits.charAt(0) === '7') {
      return '+7 ' + digits.slice(1, 4) + ' ' + digits.slice(4, 7) + '-' + digits.slice(7, 9) + '-' + digits.slice(9);
    }
    return String(value || '').trim();
  }

  function normalizeWhatsAppHref(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https:\/\/wa\.me\/\d+$/i.test(raw)) return raw;
    const digits = digitsOnly(raw);
    return digits ? 'https://wa.me/' + digits : '';
  }

  function normalizeTelegramHref(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https:\/\/t\.me\/[A-Za-z0-9_+]+$/i.test(raw)) return raw;
    if (raw.charAt(0) === '@') return 'https://t.me/' + raw.slice(1);
    const digits = digitsOnly(raw);
    return digits ? 'https://t.me/+' + digits : '';
  }

  function createLink(label, href, className, external) {
    const link = document.createElement('a');
    link.className = className;
    link.href = href;
    link.textContent = label;
    if (external) {
      link.target = '_blank';
      link.rel = 'noopener';
    }
    return link;
  }

  function buildContactLinks(settings) {
    const phone = settings.phone || fallbackContacts.phone;
    const whatsapp = settings.whatsapp || fallbackContacts.whatsapp;
    const telegram = settings.telegram || fallbackContacts.telegram;
    const email = settings.email || fallbackContacts.email;
    return {
      phoneLabel: formatPhoneLabel(phone),
      phoneUrl: normalizePhoneHref(phone),
      whatsappUrl: normalizeWhatsAppHref(whatsapp),
      telegramUrl: normalizeTelegramHref(telegram),
      emailUrl: email ? 'mailto:' + email : '',
      requestUrl: '/request.html'
    };
  }

  function renderHeaderContacts(contacts) {
    const header = document.querySelector('.site-header');
    const headerInner = header && header.querySelector('.site-header__inner');
    if (!headerInner || !contacts.phoneUrl) return;

    const actions = document.createElement('div');
    actions.className = 'tekstura-header-contact';
    actions.setAttribute('aria-label', 'Быстрые контакты Tekstura');
    actions.appendChild(createLink(contacts.phoneLabel, contacts.phoneUrl, 'tekstura-header-contact__phone', false));
    actions.appendChild(createLink('Получить расчёт', contacts.requestUrl, 'tekstura-header-contact__cta', false));
    headerInner.appendChild(actions);
    header.classList.add('site-header--with-contact');
  }

  function renderMobileContact(contacts) {
    const details = document.createElement('details');
    details.className = 'tekstura-mobile-contact';

    const summary = document.createElement('summary');
    summary.textContent = 'Связаться';
    summary.setAttribute('aria-label', 'Открыть способы связи с Tekstura');
    details.appendChild(summary);

    const panel = document.createElement('div');
    panel.className = 'tekstura-mobile-contact__panel';
    panel.setAttribute('aria-label', 'Способы связи');
    if (contacts.phoneUrl) panel.appendChild(createLink('Позвонить', contacts.phoneUrl, 'tekstura-mobile-contact__link', false));
    if (contacts.whatsappUrl) panel.appendChild(createLink('WhatsApp', contacts.whatsappUrl, 'tekstura-mobile-contact__link', true));
    if (contacts.telegramUrl) panel.appendChild(createLink('Telegram', contacts.telegramUrl, 'tekstura-mobile-contact__link', true));
    panel.appendChild(createLink('Получить расчёт', contacts.requestUrl, 'tekstura-mobile-contact__link tekstura-mobile-contact__link--primary', false));
    details.appendChild(panel);
    document.body.appendChild(details);
  }

  function renderCalculatorHelp(contacts) {
    const calculatorTop = document.querySelector('.calculator-app .top');
    if (!calculatorTop) return;

    const section = document.createElement('section');
    section.className = 'calculator-contact-help';
    section.setAttribute('aria-labelledby', 'calculatorContactHelpTitle');

    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.id = 'calculatorContactHelpTitle';
    title.textContent = 'Нужна помощь с расчётом?';
    const note = document.createElement('p');
    note.textContent = 'Подскажем по размерам, материалам и конфигурации лестницы.';
    copy.appendChild(title);
    copy.appendChild(note);
    section.appendChild(copy);

    const actions = document.createElement('div');
    actions.className = 'calculator-contact-help__actions';
    if (contacts.phoneUrl) actions.appendChild(createLink('Позвонить', contacts.phoneUrl, 'calculator-contact-help__link', false));
    if (contacts.whatsappUrl) actions.appendChild(createLink('WhatsApp', contacts.whatsappUrl, 'calculator-contact-help__link', true));
    if (contacts.telegramUrl) actions.appendChild(createLink('Telegram', contacts.telegramUrl, 'calculator-contact-help__link', true));
    section.appendChild(actions);
    calculatorTop.insertAdjacentElement('afterend', section);
  }

  function render(settings) {
    const contacts = buildContactLinks(settings || {});
    document.body.classList.add('tekstura-contact-ready');
    renderHeaderContacts(contacts);
    renderMobileContact(contacts);
    renderCalculatorHelp(contacts);
  }

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/contact-component.css';
  document.head.appendChild(stylesheet);

  fetch('/content/site.json', { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('Contact settings request failed');
      return response.json();
    })
    .then(render)
    .catch(function () {
      render(fallbackContacts);
    });
})();

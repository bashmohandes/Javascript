(() => {
    'use strict';

    try {
        const preference = localStorage.getItem('arcade-theme');
        const dark = preference === 'dark'
            || (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    } catch { /* Use the page's default palette when browser preferences are unavailable. */ }
})();

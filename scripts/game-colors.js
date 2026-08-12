(() => {
    'use strict';

    // The shared player-color palette used by competitive arcade games.
    window.ArcadeGameColors = Object.freeze([
        { name: 'Cream', value: '#fffdf8' },
        { name: 'Terracotta', value: '#d76b45' },
        { name: 'Apricot', value: '#e8a15b' },
        { name: 'Goldenrod', value: '#e7ca67' },
        { name: 'Sage', value: '#a9c181' },
        { name: 'Eucalyptus', value: '#70ad98' },
        { name: 'Sea glass', value: '#71a7a0' },
        { name: 'Dusty blue', value: '#75a4c7' },
        { name: 'Periwinkle', value: '#8f91bd' },
        { name: 'Mauve', value: '#b58ab4' },
        { name: 'Rose', value: '#cc8290' },
        { name: 'Walnut', value: '#9b7865' }
    ].map(color => Object.freeze(color)));
})();

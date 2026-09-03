'use strict';

const { loadManifest, publicRelease, releaseForVersion } = require('../scripts/release-notes');

function createBuildInformation(environment = process.env, manifest = loadManifest()) {
    const version = environment.BUILD_VERSION || 'dev';
    const channel = ['stable', 'alpha', 'dev'].includes(environment.BUILD_CHANNEL) ? environment.BUILD_CHANNEL : 'dev';
    const release = channel === 'stable' ? publicRelease(releaseForVersion(manifest, version)) : null;
    return { version, channel, release };
}

module.exports = { createBuildInformation };

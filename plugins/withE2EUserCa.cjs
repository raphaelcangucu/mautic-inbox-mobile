const fs = require('fs');
const path = require('path');
const {withAndroidManifest, withDangerousMod} = require('expo/config-plugins');

// Only for end-to-end builds against a local HTTPS bench: trust CAs the tester installed on the
// device, on top of the system ones. app.config.cjs applies this plugin only when
// MAUTIC_E2E_USER_CA=1, so store builds keep Android's default (system CAs only).
const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

const withConfigFile = config => withDangerousMod(config, ['android', async config => {
  const dir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'network_security_config.xml'), NETWORK_SECURITY_CONFIG);
  return config;
}]);

const withManifestReference = config => withAndroidManifest(config, config => {
  const application = config.modResults.manifest.application?.[0];
  if (application) application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
  return config;
});

module.exports = config => withManifestReference(withConfigFile(config));

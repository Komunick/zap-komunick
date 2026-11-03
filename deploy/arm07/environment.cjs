"use strict";

// Closed deployment profiles. No domain, address or project comes from user data.
const profiles = Object.freeze({
  production: Object.freeze({ name: "production", project: "superchat", host: "superchat.komunick.com", port: "5480", edge: "172.29.251", internal: "172.29.252" }),
  development: Object.freeze({ name: "development", project: "superchatdev", host: "superchatdev.komunick.com", port: "5481", edge: "172.29.249", internal: "172.29.250" })
});

function deploymentProfile(name) {
  if (!Object.hasOwn(profiles, name)) throw new Error("ARM07_ENVIRONMENT_INVALID");
  return profiles[name];
}

module.exports = { deploymentProfile, profiles };

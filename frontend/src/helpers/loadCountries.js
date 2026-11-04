export async function loadCountries() {
  try {
    const response = await fetch(
      "https://cdn.jsdelivr.net/gh/dr5hn/countries-states-cities-database@master/json/countries.json"
    );
    const data = await response.json();

    const language = localStorage.getItem("language") || "en";

    const countries = data
      .map(country => {
        let countryName =
          country.translations?.[language] ||
          country.translations?.[language.slice(0, 2)] ||
          country.name;
        return {
          iso2: country.iso2,
          phonecode: country.phonecode,
          name: countryName,
          emoji: country.emoji
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return countries;
  } catch (error) {
    console.error("Error fetching countries:", error);
    return [];
  }
}

// Zap Komunick: the country of the phone field comes from the browser language
// (pt-BR -> BR). The upstream version asked the browser for the location on
// every page load and sent it to nominatim.openstreetmap.org, with an IP lookup
// at ipinfo.io as fallback; neither is done here.
async function detectCountry() {
  const languages = [...(navigator.languages || []), navigator.language];
  for (const language of languages) {
    const match = /[-_]([A-Za-z]{2})(?![A-Za-z])/.exec(language || "");
    if (match) {
      return match[1].toUpperCase();
    }
  }
  return "BR";
}

export const loadedCountries = await loadCountries();
export const currentCountry = await detectCountry();

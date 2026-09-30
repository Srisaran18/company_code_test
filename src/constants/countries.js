/**
 * Country → currency / default timezone, with states or regions.
 * A state only lists `tz` when it differs from the country default.
 */
const s = (names) => names.map((name) => ({ name }));

export const COUNTRIES = [
  {
    code: "SA",
    name: "Saudi Arabia",
    currency: "SAR",
    timezone: "Asia/Riyadh",
    states: s([
      "Riyadh", "Makkah", "Madinah", "Eastern Province", "Qassim", "Asir", "Tabuk", "Hail",
      "Northern Borders", "Jazan", "Najran", "Al Bahah", "Al Jawf",
    ]),
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    currency: "AED",
    timezone: "Asia/Dubai",
    states: s(["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"]),
  },
  {
    code: "QA",
    name: "Qatar",
    currency: "QAR",
    timezone: "Asia/Qatar",
    states: s(["Doha", "Al Rayyan", "Al Wakrah", "Al Khor", "Umm Salal", "Al Daayen", "Al Shamal", "Al Shahaniya"]),
  },
  {
    code: "KW",
    name: "Kuwait",
    currency: "KWD",
    timezone: "Asia/Kuwait",
    states: s(["Al Asimah", "Hawalli", "Farwaniya", "Mubarak Al-Kabeer", "Ahmadi", "Jahra"]),
  },
  {
    code: "BH",
    name: "Bahrain",
    currency: "BHD",
    timezone: "Asia/Bahrain",
    states: s(["Capital", "Muharraq", "Northern", "Southern"]),
  },
  {
    code: "OM",
    name: "Oman",
    currency: "OMR",
    timezone: "Asia/Muscat",
    states: s([
      "Muscat", "Dhofar", "Musandam", "Al Buraimi", "Ad Dakhiliyah", "North Al Batinah", "South Al Batinah",
      "North Ash Sharqiyah", "South Ash Sharqiyah", "Adh Dhahirah", "Al Wusta",
    ]),
  },
  {
    code: "EG",
    name: "Egypt",
    currency: "EGP",
    timezone: "Africa/Cairo",
    states: s(["Cairo", "Giza", "Alexandria", "Qalyubia", "Sharqia", "Dakahlia", "Red Sea", "South Sinai", "Luxor", "Aswan"]),
  },
  { code: "JO", name: "Jordan", currency: "JOD", timezone: "Asia/Amman", states: s(["Amman", "Irbid", "Zarqa", "Aqaba", "Balqa", "Madaba"]) },
  {
    code: "IN",
    name: "India",
    currency: "INR",
    timezone: "Asia/Kolkata",
    states: s([
      "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
      "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
      "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
      "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
      "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
    ]),
  },
  {
    code: "PK",
    name: "Pakistan",
    currency: "PKR",
    timezone: "Asia/Karachi",
    states: s(["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad Capital Territory", "Gilgit-Baltistan", "Azad Kashmir"]),
  },
  {
    code: "BD",
    name: "Bangladesh",
    currency: "BDT",
    timezone: "Asia/Dhaka",
    states: s(["Dhaka", "Chittagong", "Khulna", "Rajshahi", "Barisal", "Sylhet", "Rangpur", "Mymensingh"]),
  },
  {
    code: "LK",
    name: "Sri Lanka",
    currency: "LKR",
    timezone: "Asia/Colombo",
    states: s(["Western", "Central", "Southern", "Northern", "Eastern", "North Western", "North Central", "Uva", "Sabaragamuwa"]),
  },
  {
    code: "NP",
    name: "Nepal",
    currency: "NPR",
    timezone: "Asia/Kathmandu",
    states: s(["Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Karnali", "Sudurpashchim"]),
  },
  { code: "SG", name: "Singapore", currency: "SGD", timezone: "Asia/Singapore", states: [] },
  {
    code: "MY",
    name: "Malaysia",
    currency: "MYR",
    timezone: "Asia/Kuala_Lumpur",
    states: [
      ...s([
        "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Penang", "Perak", "Perlis",
        "Selangor", "Terengganu", "Kuala Lumpur", "Putrajaya",
      ]),
      { name: "Sabah", tz: "Asia/Kuching" },
      { name: "Sarawak", tz: "Asia/Kuching" },
      { name: "Labuan", tz: "Asia/Kuching" },
    ],
  },
  {
    code: "ID",
    name: "Indonesia",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    states: [
      ...s(["Jakarta", "West Java", "Central Java", "East Java", "Banten", "Yogyakarta", "North Sumatra", "Riau", "West Kalimantan"]),
      { name: "Bali", tz: "Asia/Makassar" },
      { name: "South Sulawesi", tz: "Asia/Makassar" },
      { name: "East Kalimantan", tz: "Asia/Makassar" },
      { name: "Papua", tz: "Asia/Jayapura" },
      { name: "Maluku", tz: "Asia/Jayapura" },
    ],
  },
  {
    code: "PH",
    name: "Philippines",
    currency: "PHP",
    timezone: "Asia/Manila",
    states: s(["Metro Manila", "Calabarzon", "Central Luzon", "Central Visayas", "Davao Region", "Western Visayas", "Northern Mindanao"]),
  },
  {
    code: "TH",
    name: "Thailand",
    currency: "THB",
    timezone: "Asia/Bangkok",
    states: s(["Bangkok", "Chiang Mai", "Phuket", "Chonburi", "Nonthaburi", "Khon Kaen", "Songkhla"]),
  },
  { code: "VN", name: "Vietnam", currency: "VND", timezone: "Asia/Ho_Chi_Minh", states: s(["Hanoi", "Ho Chi Minh City", "Da Nang", "Hai Phong", "Can Tho"]) },
  {
    code: "CN",
    name: "China",
    currency: "CNY",
    timezone: "Asia/Shanghai",
    states: s(["Beijing", "Shanghai", "Guangdong", "Zhejiang", "Jiangsu", "Shandong", "Sichuan", "Hubei", "Fujian", "Tianjin", "Chongqing"]),
  },
  { code: "HK", name: "Hong Kong", currency: "HKD", timezone: "Asia/Hong_Kong", states: [] },
  { code: "JP", name: "Japan", currency: "JPY", timezone: "Asia/Tokyo", states: s(["Tokyo", "Osaka", "Kanagawa", "Aichi", "Hokkaido", "Fukuoka", "Kyoto"]) },
  { code: "KR", name: "South Korea", currency: "KRW", timezone: "Asia/Seoul", states: s(["Seoul", "Busan", "Incheon", "Gyeonggi", "Daegu", "Daejeon"]) },
  {
    code: "AU",
    name: "Australia",
    currency: "AUD",
    timezone: "Australia/Sydney",
    states: [
      { name: "New South Wales", tz: "Australia/Sydney" },
      { name: "Victoria", tz: "Australia/Melbourne" },
      { name: "Queensland", tz: "Australia/Brisbane" },
      { name: "South Australia", tz: "Australia/Adelaide" },
      { name: "Western Australia", tz: "Australia/Perth" },
      { name: "Tasmania", tz: "Australia/Hobart" },
      { name: "Northern Territory", tz: "Australia/Darwin" },
      { name: "Australian Capital Territory", tz: "Australia/Sydney" },
    ],
  },
  {
    code: "NZ",
    name: "New Zealand",
    currency: "NZD",
    timezone: "Pacific/Auckland",
    states: s(["Auckland", "Wellington", "Canterbury", "Waikato", "Bay of Plenty", "Otago"]),
  },
  {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    timezone: "Europe/London",
    states: s(["England", "Scotland", "Wales", "Northern Ireland"]),
  },
  { code: "IE", name: "Ireland", currency: "EUR", timezone: "Europe/Dublin", states: s(["Leinster", "Munster", "Connacht", "Ulster"]) },
  {
    code: "DE",
    name: "Germany",
    currency: "EUR",
    timezone: "Europe/Berlin",
    states: s([
      "Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hesse", "Lower Saxony",
      "Mecklenburg-Vorpommern", "North Rhine-Westphalia", "Rhineland-Palatinate", "Saarland", "Saxony",
      "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia",
    ]),
  },
  {
    code: "FR",
    name: "France",
    currency: "EUR",
    timezone: "Europe/Paris",
    states: s(["Île-de-France", "Auvergne-Rhône-Alpes", "Provence-Alpes-Côte d'Azur", "Occitanie", "Nouvelle-Aquitaine", "Hauts-de-France", "Grand Est", "Brittany"]),
  },
  { code: "IT", name: "Italy", currency: "EUR", timezone: "Europe/Rome", states: s(["Lombardy", "Lazio", "Campania", "Sicily", "Veneto", "Piedmont", "Tuscany"]) },
  {
    code: "ES",
    name: "Spain",
    currency: "EUR",
    timezone: "Europe/Madrid",
    states: [...s(["Madrid", "Catalonia", "Andalusia", "Valencia", "Basque Country", "Galicia"]), { name: "Canary Islands", tz: "Atlantic/Canary" }],
  },
  { code: "NL", name: "Netherlands", currency: "EUR", timezone: "Europe/Amsterdam", states: s(["North Holland", "South Holland", "Utrecht", "North Brabant", "Gelderland"]) },
  { code: "BE", name: "Belgium", currency: "EUR", timezone: "Europe/Brussels", states: s(["Brussels", "Flanders", "Wallonia"]) },
  { code: "CH", name: "Switzerland", currency: "CHF", timezone: "Europe/Zurich", states: s(["Zurich", "Geneva", "Bern", "Basel-Stadt", "Vaud", "Ticino"]) },
  { code: "SE", name: "Sweden", currency: "SEK", timezone: "Europe/Stockholm", states: s(["Stockholm", "Västra Götaland", "Skåne", "Uppsala"]) },
  { code: "NO", name: "Norway", currency: "NOK", timezone: "Europe/Oslo", states: s(["Oslo", "Viken", "Vestland", "Rogaland", "Trøndelag"]) },
  { code: "DK", name: "Denmark", currency: "DKK", timezone: "Europe/Copenhagen", states: s(["Capital Region", "Central Denmark", "Southern Denmark", "Zealand", "North Denmark"]) },
  { code: "PL", name: "Poland", currency: "PLN", timezone: "Europe/Warsaw", states: s(["Masovian", "Lesser Poland", "Silesian", "Greater Poland", "Lower Silesian", "Pomeranian"]) },
  { code: "TR", name: "Turkey", currency: "TRY", timezone: "Europe/Istanbul", states: s(["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana"]) },
  {
    code: "RU",
    name: "Russia",
    currency: "RUB",
    timezone: "Europe/Moscow",
    states: [
      ...s(["Moscow", "Saint Petersburg", "Moscow Oblast", "Tatarstan"]),
      { name: "Sverdlovsk Oblast", tz: "Asia/Yekaterinburg" },
      { name: "Novosibirsk Oblast", tz: "Asia/Novosibirsk" },
      { name: "Krasnoyarsk Krai", tz: "Asia/Krasnoyarsk" },
      { name: "Primorsky Krai", tz: "Asia/Vladivostok" },
    ],
  },
  {
    code: "ZA",
    name: "South Africa",
    currency: "ZAR",
    timezone: "Africa/Johannesburg",
    states: s(["Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", "Free State", "Limpopo", "Mpumalanga", "North West", "Northern Cape"]),
  },
  { code: "NG", name: "Nigeria", currency: "NGN", timezone: "Africa/Lagos", states: s(["Lagos", "Abuja FCT", "Kano", "Rivers", "Oyo", "Kaduna"]) },
  { code: "KE", name: "Kenya", currency: "KES", timezone: "Africa/Nairobi", states: s(["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu"]) },
  {
    code: "US",
    name: "United States",
    currency: "USD",
    timezone: "America/New_York",
    states: [
      ["Alabama", "America/Chicago"], ["Alaska", "America/Anchorage"], ["Arizona", "America/Phoenix"],
      ["Arkansas", "America/Chicago"], ["California", "America/Los_Angeles"], ["Colorado", "America/Denver"],
      ["Connecticut"], ["Delaware"], ["District of Columbia"], ["Florida"], ["Georgia"],
      ["Hawaii", "Pacific/Honolulu"], ["Idaho", "America/Boise"], ["Illinois", "America/Chicago"],
      ["Indiana", "America/Indiana/Indianapolis"], ["Iowa", "America/Chicago"], ["Kansas", "America/Chicago"],
      ["Kentucky"], ["Louisiana", "America/Chicago"], ["Maine"], ["Maryland"], ["Massachusetts"],
      ["Michigan", "America/Detroit"], ["Minnesota", "America/Chicago"], ["Mississippi", "America/Chicago"],
      ["Missouri", "America/Chicago"], ["Montana", "America/Denver"], ["Nebraska", "America/Chicago"],
      ["Nevada", "America/Los_Angeles"], ["New Hampshire"], ["New Jersey"], ["New Mexico", "America/Denver"],
      ["New York"], ["North Carolina"], ["North Dakota", "America/Chicago"], ["Ohio"],
      ["Oklahoma", "America/Chicago"], ["Oregon", "America/Los_Angeles"], ["Pennsylvania"], ["Rhode Island"],
      ["South Carolina"], ["South Dakota", "America/Chicago"], ["Tennessee", "America/Chicago"],
      ["Texas", "America/Chicago"], ["Utah", "America/Denver"], ["Vermont"], ["Virginia"],
      ["Washington", "America/Los_Angeles"], ["West Virginia"], ["Wisconsin", "America/Chicago"],
      ["Wyoming", "America/Denver"],
    ].map(([name, tz]) => (tz ? { name, tz } : { name })),
  },
  {
    code: "CA",
    name: "Canada",
    currency: "CAD",
    timezone: "America/Toronto",
    states: [
      { name: "Ontario", tz: "America/Toronto" },
      { name: "Quebec", tz: "America/Toronto" },
      { name: "British Columbia", tz: "America/Vancouver" },
      { name: "Alberta", tz: "America/Edmonton" },
      { name: "Manitoba", tz: "America/Winnipeg" },
      { name: "Saskatchewan", tz: "America/Regina" },
      { name: "Nova Scotia", tz: "America/Halifax" },
      { name: "New Brunswick", tz: "America/Moncton" },
      { name: "Newfoundland and Labrador", tz: "America/St_Johns" },
      { name: "Prince Edward Island", tz: "America/Halifax" },
      { name: "Yukon", tz: "America/Whitehorse" },
      { name: "Northwest Territories", tz: "America/Yellowknife" },
      { name: "Nunavut", tz: "America/Iqaluit" },
    ],
  },
  {
    code: "MX",
    name: "Mexico",
    currency: "MXN",
    timezone: "America/Mexico_City",
    states: [
      ...s(["Mexico City", "State of Mexico", "Jalisco", "Nuevo León", "Puebla", "Guanajuato", "Veracruz", "Yucatán"]),
      { name: "Quintana Roo", tz: "America/Cancun" },
      { name: "Baja California", tz: "America/Tijuana" },
      { name: "Sonora", tz: "America/Hermosillo" },
      { name: "Chihuahua", tz: "America/Chihuahua" },
    ],
  },
  {
    code: "BR",
    name: "Brazil",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    states: [
      ...s(["São Paulo", "Rio de Janeiro", "Minas Gerais", "Paraná", "Rio Grande do Sul", "Santa Catarina", "Distrito Federal", "Bahia"]),
      { name: "Pernambuco", tz: "America/Recife" },
      { name: "Ceará", tz: "America/Fortaleza" },
      { name: "Amazonas", tz: "America/Manaus" },
      { name: "Mato Grosso", tz: "America/Cuiaba" },
    ],
  },
  { code: "AR", name: "Argentina", currency: "ARS", timezone: "America/Argentina/Buenos_Aires", states: s(["Buenos Aires", "Córdoba", "Santa Fe", "Mendoza"]) },
].sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRY_OPTIONS = COUNTRIES.map((item) => ({ value: item.code, label: item.name }));

export const CURRENCY_OPTIONS = [...new Set(COUNTRIES.map((item) => item.currency))]
  .sort()
  .map((code) => ({ value: code, label: code }));

/** Accepts an ISO code or a stored country name. */
export function findCountry(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return null;
  return COUNTRIES.find((item) => item.code.toLowerCase() === key || item.name.toLowerCase() === key) || null;
}

export function countryName(value) {
  return findCountry(value)?.name || value || "";
}

export function timezoneFor(countryValue, stateName) {
  const country = findCountry(countryValue);
  if (!country) return "";
  return country.states.find((item) => item.name === stateName)?.tz || country.timezone;
}

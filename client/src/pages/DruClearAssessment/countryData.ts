export interface CountryCode {
  code: string;
  iso: string;
  name: string;
  flag: string;
  hint: string;
  minLen: number;
  maxLen: number;
}

const TIMEZONE_TO_ISO: Record<string, string> = {
  "America/New_York": "US","America/Chicago": "US","America/Denver": "US","America/Los_Angeles": "US",
  "America/Phoenix": "US","America/Anchorage": "US","Pacific/Honolulu": "US","America/Detroit": "US",
  "America/Indiana/Indianapolis": "US","America/Toronto": "CA","America/Vancouver": "CA","America/Montreal": "CA",
  "America/Mexico_City": "MX","America/Sao_Paulo": "BR","America/Argentina/Buenos_Aires": "AR",
  "America/Bogota": "CO","America/Lima": "PE","America/Santiago": "CL","America/Caracas": "VE",
  "Europe/London": "GB","Europe/Dublin": "IE","Europe/Paris": "FR","Europe/Berlin": "DE",
  "Europe/Madrid": "ES","Europe/Rome": "IT","Europe/Amsterdam": "NL","Europe/Brussels": "BE",
  "Europe/Stockholm": "SE","Europe/Oslo": "NO","Europe/Copenhagen": "DK","Europe/Helsinki": "FI",
  "Europe/Warsaw": "PL","Europe/Moscow": "RU","Europe/Istanbul": "TR","Europe/Athens": "GR",
  "Asia/Tokyo": "JP","Asia/Seoul": "KR","Asia/Shanghai": "CN","Asia/Hong_Kong": "HK",
  "Asia/Singapore": "SG","Asia/Kolkata": "IN","Asia/Dubai": "AE","Asia/Riyadh": "SA",
  "Australia/Sydney": "AU","Australia/Melbourne": "AU","Australia/Brisbane": "AU",
  "Pacific/Auckland": "NZ","Africa/Cairo": "EG","Africa/Johannesburg": "ZA","Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
};

export function detectCountryFromTimezone(): CountryCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const iso = TIMEZONE_TO_ISO[tz];
    if (iso) { const found = COUNTRY_CODES.find((c) => c.iso === iso); if (found) return found; }
  } catch {}
  return COUNTRY_CODES[0];
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: "+1", iso: "US", name: "United States", flag: "🇺🇸", hint: "Format: (555) 000-0000", minLen: 10, maxLen: 10 },
  { code: "+1", iso: "CA", name: "Canada", flag: "🇨🇦", hint: "Format: (555) 000-0000", minLen: 10, maxLen: 10 },
  { code: "+7", iso: "RU", name: "Russia", flag: "🇷🇺", hint: "Format: 9xx xxx xx xx", minLen: 10, maxLen: 10 },
  { code: "+20", iso: "EG", name: "Egypt", flag: "🇪🇬", hint: "Format: 1x xxxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+27", iso: "ZA", name: "South Africa", flag: "🇿🇦", hint: "Format: 7x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+30", iso: "GR", name: "Greece", flag: "🇬🇷", hint: "Format: 6xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+31", iso: "NL", name: "Netherlands", flag: "🇳🇱", hint: "Format: 6 xxxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+32", iso: "BE", name: "Belgium", flag: "🇧🇪", hint: "Format: 4xx xx xx xx", minLen: 9, maxLen: 9 },
  { code: "+33", iso: "FR", name: "France", flag: "🇫🇷", hint: "Format: 6xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+34", iso: "ES", name: "Spain", flag: "🇪🇸", hint: "Format: 6xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+36", iso: "HU", name: "Hungary", flag: "🇭🇺", hint: "Format: 20 xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+39", iso: "IT", name: "Italy", flag: "🇮🇹", hint: "Format: 3xx xxx xxxx", minLen: 9, maxLen: 11 },
  { code: "+40", iso: "RO", name: "Romania", flag: "🇷🇴", hint: "Format: 7xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+41", iso: "CH", name: "Switzerland", flag: "🇨🇭", hint: "Format: 7x xxx xx xx", minLen: 9, maxLen: 9 },
  { code: "+43", iso: "AT", name: "Austria", flag: "🇦🇹", hint: "Format: 6xx xxxxxx", minLen: 7, maxLen: 13 },
  { code: "+44", iso: "GB", name: "United Kingdom", flag: "🇬🇧", hint: "Format: 07xxx xxxxxx", minLen: 10, maxLen: 10 },
  { code: "+45", iso: "DK", name: "Denmark", flag: "🇩🇰", hint: "Format: xx xx xx xx", minLen: 8, maxLen: 8 },
  { code: "+46", iso: "SE", name: "Sweden", flag: "🇸🇪", hint: "Format: 7x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+47", iso: "NO", name: "Norway", flag: "🇳🇴", hint: "Format: xxx xx xxx", minLen: 8, maxLen: 8 },
  { code: "+48", iso: "PL", name: "Poland", flag: "🇵🇱", hint: "Format: xxx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+49", iso: "DE", name: "Germany", flag: "🇩🇪", hint: "Format: 1xx xxxxxxxx", minLen: 10, maxLen: 12 },
  { code: "+51", iso: "PE", name: "Peru", flag: "🇵🇪", hint: "Format: 9xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+52", iso: "MX", name: "Mexico", flag: "🇲🇽", hint: "Format: 1xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+54", iso: "AR", name: "Argentina", flag: "🇦🇷", hint: "Format: 9 11 xxxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+55", iso: "BR", name: "Brazil", flag: "🇧🇷", hint: "Format: 11 9xxxx xxxx", minLen: 10, maxLen: 11 },
  { code: "+56", iso: "CL", name: "Chile", flag: "🇨🇱", hint: "Format: 9 xxxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+57", iso: "CO", name: "Colombia", flag: "🇨🇴", hint: "Format: 3xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+60", iso: "MY", name: "Malaysia", flag: "🇲🇾", hint: "Format: 1x xxxx xxxx", minLen: 9, maxLen: 10 },
  { code: "+61", iso: "AU", name: "Australia", flag: "🇦🇺", hint: "Format: 4xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+62", iso: "ID", name: "Indonesia", flag: "🇮🇩", hint: "Format: 8xx xxxx xxxx", minLen: 9, maxLen: 12 },
  { code: "+63", iso: "PH", name: "Philippines", flag: "🇵🇭", hint: "Format: 9xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+64", iso: "NZ", name: "New Zealand", flag: "🇳🇿", hint: "Format: 2x xxx xxxx", minLen: 8, maxLen: 10 },
  { code: "+65", iso: "SG", name: "Singapore", flag: "🇸🇬", hint: "Format: 8xxx xxxx", minLen: 8, maxLen: 8 },
  { code: "+66", iso: "TH", name: "Thailand", flag: "🇹🇭", hint: "Format: 8x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+81", iso: "JP", name: "Japan", flag: "🇯🇵", hint: "Format: 9x xxxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+82", iso: "KR", name: "South Korea", flag: "🇰🇷", hint: "Format: 10x xxxx xxxx", minLen: 9, maxLen: 10 },
  { code: "+84", iso: "VN", name: "Vietnam", flag: "🇻🇳", hint: "Format: 9xx xxx xxx", minLen: 9, maxLen: 10 },
  { code: "+86", iso: "CN", name: "China", flag: "🇨🇳", hint: "Format: 1xx xxxx xxxx", minLen: 11, maxLen: 11 },
  { code: "+90", iso: "TR", name: "Turkey", flag: "🇹🇷", hint: "Format: 5xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+91", iso: "IN", name: "India", flag: "🇮🇳", hint: "Format: 9xxxx xxxxx", minLen: 10, maxLen: 10 },
  { code: "+92", iso: "PK", name: "Pakistan", flag: "🇵🇰", hint: "Format: 3xx xxxxxxx", minLen: 10, maxLen: 10 },
  { code: "+94", iso: "LK", name: "Sri Lanka", flag: "🇱🇰", hint: "Format: 7x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+98", iso: "IR", name: "Iran", flag: "🇮🇷", hint: "Format: 9xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+212", iso: "MA", name: "Morocco", flag: "🇲🇦", hint: "Format: 6xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+213", iso: "DZ", name: "Algeria", flag: "🇩🇿", hint: "Format: 5xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+216", iso: "TN", name: "Tunisia", flag: "🇹🇳", hint: "Format: 2x xxx xxx", minLen: 8, maxLen: 8 },
  { code: "+221", iso: "SN", name: "Senegal", flag: "🇸🇳", hint: "Format: 7x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+233", iso: "GH", name: "Ghana", flag: "🇬🇭", hint: "Format: 2x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+234", iso: "NG", name: "Nigeria", flag: "🇳🇬", hint: "Format: 8xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+237", iso: "CM", name: "Cameroon", flag: "🇨🇲", hint: "Format: 6xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+249", iso: "SD", name: "Sudan", flag: "🇸🇩", hint: "Format: 9x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+250", iso: "RW", name: "Rwanda", flag: "🇷🇼", hint: "Format: 7xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+251", iso: "ET", name: "Ethiopia", flag: "🇪🇹", hint: "Format: 9x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+254", iso: "KE", name: "Kenya", flag: "🇰🇪", hint: "Format: 7xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+255", iso: "TZ", name: "Tanzania", flag: "🇹🇿", hint: "Format: 7xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+256", iso: "UG", name: "Uganda", flag: "🇺🇬", hint: "Format: 7xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+260", iso: "ZM", name: "Zambia", flag: "🇿🇲", hint: "Format: 9x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+263", iso: "ZW", name: "Zimbabwe", flag: "🇿🇼", hint: "Format: 7x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+351", iso: "PT", name: "Portugal", flag: "🇵🇹", hint: "Format: 9xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+352", iso: "LU", name: "Luxembourg", flag: "🇱🇺", hint: "Format: 6xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+353", iso: "IE", name: "Ireland", flag: "🇮🇪", hint: "Format: 8x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+358", iso: "FI", name: "Finland", flag: "🇫🇮", hint: "Format: 4x xxx xxxx", minLen: 9, maxLen: 10 },
  { code: "+380", iso: "UA", name: "Ukraine", flag: "🇺🇦", hint: "Format: 5x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+420", iso: "CZ", name: "Czech Republic", flag: "🇨🇿", hint: "Format: 6xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+421", iso: "SK", name: "Slovakia", flag: "🇸🇰", hint: "Format: 9xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+852", iso: "HK", name: "Hong Kong", flag: "🇭🇰", hint: "Format: xxxx xxxx", minLen: 8, maxLen: 8 },
  { code: "+855", iso: "KH", name: "Cambodia", flag: "🇰🇭", hint: "Format: 1x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+880", iso: "BD", name: "Bangladesh", flag: "🇧🇩", hint: "Format: 1xxx xxxxxx", minLen: 10, maxLen: 10 },
  { code: "+886", iso: "TW", name: "Taiwan", flag: "🇹🇼", hint: "Format: 9xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+961", iso: "LB", name: "Lebanon", flag: "🇱🇧", hint: "Format: 7x xxx xxx", minLen: 7, maxLen: 8 },
  { code: "+962", iso: "JO", name: "Jordan", flag: "🇯🇴", hint: "Format: 7x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+966", iso: "SA", name: "Saudi Arabia", flag: "🇸🇦", hint: "Format: 5x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+971", iso: "AE", name: "UAE", flag: "🇦🇪", hint: "Format: 5x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+972", iso: "IL", name: "Israel", flag: "🇮🇱", hint: "Format: 5x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+973", iso: "BH", name: "Bahrain", flag: "🇧🇭", hint: "Format: 3xxx xxxx", minLen: 8, maxLen: 8 },
  { code: "+974", iso: "QA", name: "Qatar", flag: "🇶🇦", hint: "Format: 3xxx xxxx", minLen: 8, maxLen: 8 },
  { code: "+977", iso: "NP", name: "Nepal", flag: "🇳🇵", hint: "Format: 98x xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+994", iso: "AZ", name: "Azerbaijan", flag: "🇦🇿", hint: "Format: 5x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+995", iso: "GE", name: "Georgia", flag: "🇬🇪", hint: "Format: 5xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+998", iso: "UZ", name: "Uzbekistan", flag: "🇺🇿", hint: "Format: 9x xxx xxxx", minLen: 9, maxLen: 9 },
];
